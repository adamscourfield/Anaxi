/** Arbor's leaf classes can omit subject even when their label is explicit. */
export function arborClassSubjectName(className: string | null): string {
  const parts = (className ?? "").split(":").map((part) => part.trim());
  const yearIndex = parts.findIndex((part) => /^Year\s+\d+\b/i.test(part));
  const yearSubject = yearIndex >= 0 ? parts[yearIndex].replace(/^Year\s+\d+\b/i, "").trim() : "";
  const label = (yearSubject || (yearIndex === 0 ? "" : parts[yearIndex > 0 ? yearIndex - 1 : 0]) || "").replace(/\s*\(\d{4}\/(?:\d{2}|\d{4})\)\s*$/, "").trim();
  if (/^CN Sports St$/i.test(label)) return "Sport Studies";
  if (/^GCSE RS$/i.test(label)) return "Religious Education";
  return label.replace(/^GCSE\s+/i, "");
}

export function arborAcademicUnitSubject(subject: string | null | undefined, className: string | null): string {
  return subject?.trim() || arborClassSubjectName(className);
}
