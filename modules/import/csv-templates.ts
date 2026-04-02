export const STRICT_TEMPLATE_COLUMNS = [
  'UPN',
  'Name',
  'YearGroup',
  'PositivePointsTotal',
  'Detentions',
  'InternalExclusions',
  'Suspensions',
  'Attendance',
  'Lateness',
  'SEND',
  'PP',
  'Status',
] as const

export type StrictTemplateColumn = (typeof STRICT_TEMPLATE_COLUMNS)[number]

export function generateCSVTemplate(): string {
  const header = STRICT_TEMPLATE_COLUMNS.join(',')
  const example1 = 'T001,John Doe,Y9,45,2,0,0,92.5,1,No,No,Active'
  const example2 = 'T002,Jane Smith,Y9,38,1,0,0,95.0,0,No,Yes,Active'
  return [header, example1, example2].join('\n')
}

export function validateAgainstTemplate(headers: string[]): { valid: boolean; missingColumns: string[] } {
  const required = ['UPN', 'Name', 'YearGroup', 'Attendance']
  const missingColumns = required.filter((col) => !headers.includes(col))
  return { valid: missingColumns.length === 0, missingColumns }
}
