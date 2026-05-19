/** Current UK academic year label, e.g. "2025/26". */
export function defaultAcademicYearLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan; academic year starts September
  const startYear = month >= 8 ? year : year - 1;
  const endShort = String(startYear + 1).slice(-2);
  return `${startYear}/${endShort}`;
}

export function defaultAcademicYearDates(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 8 ? year : year - 1;
  return {
    startDate: `${startYear}-09-01`,
    endDate: `${startYear + 1}-08-31`,
  };
}
