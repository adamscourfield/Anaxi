import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canViewExplorer, canViewAssessmentExplorer } from "@/modules/authz";
import { prisma } from "@/lib/prisma";
import { VALID_WINDOWS } from "@/lib/explorerUtils";
import { computeTeacherRiskIndex } from "@/modules/analysis/teacherRisk";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import { computeAssessmentAnalysis } from "@/modules/analysis/assessmentAnalysis";
import { computeLOAImpact } from "@/modules/analysis/loaImpact";
import { computeAttainmentBehaviourCorrelation } from "@/modules/analysis/attainmentBehaviourCorrelation";
import { apiErrorResponse } from "@/lib/apiErrors";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIBriefing = {
  headline: string;
  recommendations: string[];
  positiveSignals: string[];
  computedAt: string;
};

type CacheEntry = { data: AIBriefing; expiresAt: number };

// ─── In-memory cache (30 min, max 500 entries) ────────────────────────────────

const briefingCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

function getCached(key: string): AIBriefing | null {
  const entry = briefingCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    briefingCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: AIBriefing): void {
  if (briefingCache.size >= MAX_CACHE_SIZE) {
    const oldest = briefingCache.keys().next().value;
    if (oldest !== undefined) briefingCache.delete(oldest);
  }
  briefingCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── XML attribute escaping ───────────────────────────────────────────────────

function xmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(data: {
  windowDays: number;
  driftingTeachers: { name: string; status: string; normalizedIDS: number }[];
  urgentStudents: { name: string; band: string; yearGroup: string | null; sendFlag: boolean; ppFlag: boolean }[];
  valueAddConcerns: { teacherName: string; subject: string; valueAdd: number }[];
  strongCorrelations: { metricLabel: string; correlation: number; strength: string; sampleSize: number }[];
  loaImpacts: { teacherName: string; daysAbsent: number; urgentPriorityPct: number; deviation: number }[];
  schoolMean: number | null;
  sendGap: number | null;
  ppGap: number | null;
  totalStudents: number;
  totalTeachers: number;
}): string {
  const fmtPp = (n: number) => (n >= 0 ? `+${(n * 100).toFixed(1)}pp` : `${(n * 100).toFixed(1)}pp`);

  const lines: string[] = [
    `<school_data window_days="${data.windowDays}">`,
    `  <summary>`,
    `    <total_students>${data.totalStudents}</total_students>`,
    `    <total_teachers>${data.totalTeachers}</total_teachers>`,
    `    <school_mean>${data.schoolMean !== null ? data.schoolMean.toFixed(3) : "n/a"}</school_mean>`,
    `    <send_gap>${data.sendGap !== null ? fmtPp(data.sendGap) : "n/a"}</send_gap>`,
    `    <pp_gap>${data.ppGap !== null ? fmtPp(data.ppGap) : "n/a"}</pp_gap>`,
    `  </summary>`,
  ];

  if (data.driftingTeachers.length > 0) {
    lines.push(`  <drifting_teachers>`);
    for (const t of data.driftingTeachers) {
      lines.push(`    <teacher name="${xmlAttr(t.name)}" status="${xmlAttr(t.status)}" ids="${t.normalizedIDS.toFixed(2)}" />`);
    }
    lines.push(`  </drifting_teachers>`);
  }

  if (data.urgentStudents.length > 0) {
    lines.push(`  <urgent_students>`);
    for (const s of data.urgentStudents) {
      const flags = [s.sendFlag && "SEND", s.ppFlag && "PP"].filter(Boolean).join(",");
      lines.push(`    <student name="${xmlAttr(s.name)}" band="${xmlAttr(s.band)}" year="${xmlAttr(s.yearGroup ?? "?")}"${flags ? ` flags="${flags}"` : ""} />`);
    }
    lines.push(`  </urgent_students>`);
  }

  if (data.valueAddConcerns.length > 0) {
    lines.push(`  <value_add_concerns>`);
    for (const v of data.valueAddConcerns) {
      lines.push(`    <concern teacher="${xmlAttr(v.teacherName)}" subject="${xmlAttr(v.subject)}" value_add="${fmtPp(v.valueAdd)}" />`);
    }
    lines.push(`  </value_add_concerns>`);
  }

  if (data.strongCorrelations.length > 0) {
    lines.push(`  <attainment_behaviour_correlations>`);
    for (const c of data.strongCorrelations) {
      lines.push(`    <correlation metric="${xmlAttr(c.metricLabel)}" r="${c.correlation.toFixed(2)}" strength="${xmlAttr(c.strength)}" n="${c.sampleSize}" />`);
    }
    lines.push(`  </attainment_behaviour_correlations>`);
  }

  if (data.loaImpacts.length > 0) {
    lines.push(`  <loa_impacts>`);
    for (const l of data.loaImpacts) {
      lines.push(`    <impact teacher="${xmlAttr(l.teacherName)}" days_absent="${l.daysAbsent}" urgent_pct="${(l.urgentPriorityPct * 100).toFixed(0)}%" deviation="${fmtPp(l.deviation)}" />`);
    }
    lines.push(`  </loa_impacts>`);
  }

  lines.push(`</school_data>`);
  return lines.join("\n");
}

// ─── Parse Claude response ────────────────────────────────────────────────────

function parseBriefingResponse(text: string): Omit<AIBriefing, "computedAt"> {
  const headlineMatch = text.match(/<headline>([\s\S]*?)<\/headline>/);
  if (!headlineMatch) throw new Error("parse failure: no <headline> in Claude response");
  const headline = headlineMatch[1].trim();

  const recsMatch = text.match(/<recommendations>([\s\S]*?)<\/recommendations>/);
  const recommendations: string[] = [];
  if (recsMatch) {
    for (const m of recsMatch[1].matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      recommendations.push(m[1].trim());
    }
  }

  const posMatch = text.match(/<positive_signals>([\s\S]*?)<\/positive_signals>/);
  const positiveSignals: string[] = [];
  if (posMatch) {
    for (const m of posMatch[1].matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      positiveSignals.push(m[1].trim());
    }
  }

  return {
    headline: headline || "School performance overview",
    recommendations: recommendations.length > 0 ? recommendations : ["Review flagged areas in the Explorer dashboard."],
    positiveSignals,
  };
}

const SYSTEM_PROMPT = `You are an expert school improvement analyst. You receive structured data from a school management system and produce a concise, actionable briefing for senior school leaders.

Your response MUST be valid XML in exactly this format:
<briefing>
  <headline>One sentence (max 120 chars) describing the most important finding.</headline>
  <recommendations>
    <item>Specific, actionable recommendation (max 150 chars each)</item>
    <item>...</item>
  </recommendations>
  <positive_signals>
    <item>Positive finding worth noting (max 120 chars each)</item>
    <item>...</item>
  </positive_signals>
</briefing>

Rules:
- 1 headline, 3–5 recommendations, 1–3 positive signals.
- Be specific: name subjects, year groups, and patterns when the data supports it.
- Prioritise SEND and PP gaps, drifting teachers, and declining students.
- Positive signals should be genuine and data-backed, not generic praise.
- Do NOT invent data not present in the input.
- Respond with the XML only — no preamble, no explanation.`;

const FALLBACK_BRIEFING = {
  headline: "AI briefing temporarily unavailable — review the Explorer dashboard directly.",
  recommendations: [
    "Check the Assessment Explorer for value-add concerns.",
    "Review the Teachers Explorer for drift flags.",
    "Monitor urgent student bands in the Students Explorer.",
  ],
  positiveSignals: [] as string[],
};

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ANALYSIS");

    // Build viewer context
    const [hodMemberships, coachAssignments] = await Promise.all([
      (prisma as any).departmentMembership.findMany({
        where: { userId: user.id, isHeadOfDepartment: true },
        select: { departmentId: true },
      }),
      (prisma as any).coachAssignment.findMany({
        where: { coachUserId: user.id },
        select: { coacheeUserId: true },
      }),
    ]);

    const hodDepartmentIds = (hodMemberships as { departmentId: string }[]).map((m) => m.departmentId);
    const coacheeUserIds = (coachAssignments as { coacheeUserId: string }[]).map((a) => a.coacheeUserId);
    const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

    if (!canViewExplorer(viewerContext) || !canViewAssessmentExplorer(viewerContext)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // Validate windowDays against the allowed set — prevents full-history DoS queries
    const windowDays: number = VALID_WINDOWS.includes(body.windowDays) ? body.windowDays : 21;
    const cycleId: string | undefined = typeof body.cycleId === "string" ? body.cycleId : undefined;

    const cacheKey = `${user.tenantId}:${windowDays}:${cycleId ?? ""}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    // ── Parallel data fetch ───────────────────────────────────────────────────
    const [teacherRisk, studentRisk, assessment, loaImpact, correlation] = await Promise.all([
      computeTeacherRiskIndex(user.tenantId, windowDays),
      computeStudentRiskIndex(user.tenantId, windowDays, user.id),
      computeAssessmentAnalysis(user.tenantId, cycleId ? { cycleId } : undefined),
      computeLOAImpact(user.tenantId, windowDays),
      computeAttainmentBehaviourCorrelation(user.tenantId, windowDays),
    ]);

    // ── Derive briefing inputs ────────────────────────────────────────────────
    const driftingTeachers = teacherRisk
      .filter((r) => r.status === "SIGNIFICANT_DRIFT" || r.status === "EMERGING_DRIFT")
      .sort((a, b) => b.normalizedIDS - a.normalizedIDS)
      .slice(0, 5)
      .map((r) => ({ name: r.teacherName, status: r.status, normalizedIDS: r.normalizedIDS }));

    const urgentStudents = studentRisk.rows
      .filter((r) => r.band === "URGENT" || r.band === "PRIORITY")
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5)
      .map((r) => ({
        name: r.studentName,
        band: r.band,
        yearGroup: r.yearGroup,
        sendFlag: r.sendFlag,
        ppFlag: r.ppFlag,
      }));

    const valueAddConcerns = assessment.teachers
      .flatMap((t) =>
        t.subjects
          .filter((s) => typeof s.valueAdd === "number" && (s.valueAdd as number) < -0.05)
          .map((s) => ({
            teacherName: t.teacherName,
            subject: s.subject,
            valueAdd: s.valueAdd as number,
          })),
      )
      .sort((a, b) => a.valueAdd - b.valueAdd)
      .slice(0, 5);

    const strongCorrelations = correlation.schoolWide
      .filter((r) => Math.abs(r.correlation) >= 0.4 && r.confidence === "HIGH")
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, 4)
      .map((r) => ({
        metricLabel: r.metricLabel,
        correlation: r.correlation,
        strength: r.strength,
        sampleSize: r.sampleSize,
      }));

    const loaImpacts = loaImpact.teacherRows
      .filter((r) => r.deviation !== null && r.deviation >= 0.1 && r.confidence === "HIGH")
      .slice(0, 3)
      .map((r) => ({
        teacherName: r.teacherName,
        daysAbsent: r.totalDaysAbsent,
        urgentPriorityPct: r.urgentPriorityPct,
        deviation: r.deviation as number,
      }));

    // Use cohort-based gaps (consistent with cohorts page and briefing)
    const allMeans = assessment.cohorts
      .map((c) => c.meanNormalizedScore)
      .filter((v): v is number => v !== null);
    const schoolMean = allMeans.length > 0
      ? allMeans.reduce((a, b) => a + b, 0) / allMeans.length
      : null;

    const sendGaps = assessment.cohorts.map((c) => c.sendGap).filter((v): v is number => v !== null);
    const avgSendGap = sendGaps.length > 0
      ? sendGaps.reduce((a, b) => a + b, 0) / sendGaps.length
      : null;

    const ppGaps = assessment.cohorts.map((c) => c.ppGap).filter((v): v is number => v !== null);
    const avgPpGap = ppGaps.length > 0
      ? ppGaps.reduce((a, b) => a + b, 0) / ppGaps.length
      : null;

    const promptContent = buildPrompt({
      windowDays,
      driftingTeachers,
      urgentStudents,
      valueAddConcerns,
      strongCorrelations,
      loaImpacts,
      schoolMean,
      sendGap: avgSendGap,
      ppGap: avgPpGap,
      totalStudents: assessment.students.length,
      totalTeachers: assessment.teachers.length,
    });

    // ── Call Claude — only cache on success, never cache fallback ────────────
    try {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: promptContent }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? textBlock.text : "";
      const parsed = parseBriefingResponse(raw); // throws if response is unparseable
      const briefing: AIBriefing = { ...parsed, computedAt: new Date().toISOString() };
      setCached(cacheKey, briefing);
      return NextResponse.json(briefing);
    } catch (claudeErr) {
      console.error("[briefing] Claude error:", claudeErr);
      return NextResponse.json({ ...FALLBACK_BRIEFING, computedAt: new Date().toISOString() });
    }
  } catch (err) {
    return apiErrorResponse(err);
  }
}
