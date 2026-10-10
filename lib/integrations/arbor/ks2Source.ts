import { runArborGraphqlQuery } from "./graphqlClient";
import type { ArborCredentials } from "./types";
import type { Ks2Result } from "./ks2PriorAttainment";

export type Ks2Definition = { id: string; assessmentName: string | null; assessmentShortName: string | null; displayName: string | null; code: string | null; markMinValue: number | null; markMaxValue: number | null };
export function ks2DefinitionSubject(definition: Ks2Definition): Ks2Result["subject"] | null {
  const label = [definition.assessmentName, definition.assessmentShortName, definition.displayName, definition.code].filter(Boolean).join(" ");
  if (!/\bKS\s*2\b|\bKey Stage\s*2\b|__KS2__/i.test(label)) return null;
  if (!/\bscaled\b|__SS(?:__|$)/i.test(label) && !(definition.markMinValue === 80 && definition.markMaxValue === 120)) return null;
  const reading = /\breading\b|__REA(?:__|$)/i.test(label);
  const maths = /\bmath(?:s|ematics)?\b|__MAT(?:__|$)/i.test(label);
  return reading !== maths ? reading ? "reading" : "maths" : null;
}

type SourceMark = { student: { id: string } | null; standardizedAssessment: { id: string } | null; markInteger: number | null; markDecimal: number | null; markGrade: { displayName: string | null; shortName: string | null } | null };
export function ks2MarkScore(mark: Pick<SourceMark, "markInteger" | "markDecimal" | "markGrade">): number | null {
  const raw = mark.markInteger ?? mark.markDecimal ?? mark.markGrade?.shortName ?? mark.markGrade?.displayName;
  if (raw == null || (typeof raw === "string" && !/^\d+$/.test(raw.trim()))) return null;
  const score = Number(raw);
  return Number.isInteger(score) && score >= 80 && score <= 120 ? score : null;
}

/** Fields confirmed against the live Arbor schema. Never traverse ungranted aspect/template models. */
export async function loadArborKs2Results(credentials: ArborCredentials) {
  const definitions: Ks2Definition[] = [];
  let catalogueComplete = false;
  for (let page = 0; page < 40; page++) {
    const data = await runArborGraphqlQuery<{ StandardizedAssessment: Ks2Definition[] }>(credentials, `{
      StandardizedAssessment(page_size: 500, page_num: ${page}) { id assessmentName assessmentShortName displayName code markMinValue markMaxValue }
    }`);
    definitions.push(...data.StandardizedAssessment);
    if (data.StandardizedAssessment.length < 500) { catalogueComplete = true; break; }
  }
  if (!catalogueComplete) throw new Error("Arbor's standardised assessment catalogue exceeded the scan limit. No scores were imported.");
  const matchedDefinitions = definitions.flatMap((definition) => {
    const subject = ks2DefinitionSubject(definition);
    return subject ? [{ ...definition, subject }] : [];
  });
  const subjects = new Map(matchedDefinitions.map((definition) => [definition.id, definition.subject]));
  const results: Ks2Result[] = [];
  let scanned = 0;
  let invalid = 0;
  if (!subjects.size) return { results, matchedDefinitions, scanned, invalid, catalogue: definitions.filter((definition) => /KS\s*2|Key Stage\s*2|__KS2__/i.test([definition.assessmentName, definition.code].join(" "))) };
  const schema = await runArborGraphqlQuery<{ __schema: { queryType: { fields: Array<{ name: string; args: Array<{ name: string }> }> } } }>(credentials, `{
    __schema { queryType { fields { name args { name } } } }
  }`);
  const hasFilter = schema.__schema.queryType.fields.find((field) => field.name === "StudentStandardizedAssessmentMark")?.args.some((arg) => arg.name === "standardizedAssessment__id_in");
  const filter = hasFilter ? `, standardizedAssessment__id_in: [${[...subjects.keys()].map((id) => JSON.stringify(id)).join(",")}]` : "";
  for (let page = 0; page < 200; page++) {
    const data = await runArborGraphqlQuery<{ StudentStandardizedAssessmentMark: SourceMark[] }>(credentials, `{
      StudentStandardizedAssessmentMark(page_size: 500, page_num: ${page}${filter}) {
        student { id } standardizedAssessment { id } markInteger markDecimal markGrade { displayName shortName }
      }
    }`);
    for (const mark of data.StudentStandardizedAssessmentMark) {
      scanned++;
      const subject = mark.standardizedAssessment ? subjects.get(mark.standardizedAssessment.id) : undefined;
      if (!subject || !mark.student) continue;
      const score = ks2MarkScore(mark);
      if (score === null) { invalid++; continue; }
      results.push({ studentExternalId: mark.student.id, subject, score });
    }
    if (data.StudentStandardizedAssessmentMark.length < 500) return { results, matchedDefinitions, scanned, invalid, catalogue: [] };
  }
  throw new Error("Arbor returned more than 100,000 standardised marks. No scores were imported; narrow the scan before retrying.");
}
