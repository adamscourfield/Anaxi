export interface StudentWithLatestSnapshot {
  id: string
  tenantId: string
  upn: string | null
  fullName: string
  yearGroup: string | null
  ks2ReadingScaledScore: number | null
  ks2MathsScaledScore: number | null
  sendFlag: boolean
  ppFlag: boolean
  status: 'ACTIVE' | 'ARCHIVED'
  latestSnapshot: StudentSnapshotRecord | null
  activeFlags: number
}

export interface StudentSnapshotRecord {
  id: string
  studentId: string
  snapshotDate: Date
  positivePointsTotal: number
  detentionsCount: number
  internalExclusionsCount: number
  suspensionsCount: number
  onCallsCount: number
  attendancePct: number
  latenessCount: number
}

export interface StudentTrendMetrics {
  attendanceDelta: StudentDelta | null
  detentionsDelta: StudentDelta | null
  onCallsDelta: StudentDelta | null
  latenessDelta: StudentDelta | null
  suspensionsDelta: StudentDelta | null
  internalExclusionsDelta: StudentDelta | null
  behaviourSpikeFlag: boolean
  attendanceDropFlag: boolean
}

export interface StudentDelta {
  current: number
  previous: number
  delta: number
  percentChange: number | null
}

export interface ImportJobReport {
  jobId: string
  status: string
  rowsProcessed: number
  rowsFailed: number
  errors: Array<{ rowNumber: number; field: string; message: string }>
  startedAt: Date | null
  finishedAt: Date | null
}
