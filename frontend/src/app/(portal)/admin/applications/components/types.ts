import type { CycleStatus, Role } from '@/lib/api/types'

// One row per (cycle, role) pairing — the set of questions/challenges an
// applicant fills out for that role in that cycle. Not to be confused with
// `Application`, which is an applicant's individual submission.
export type ApplicationTemplateCard = {
  cycleId: string
  cycleName: string
  cycleStatus: CycleStatus
  cycleColorIndex: number
  opensAt: string | null
  closesAt: string | null
  role: Role
  title: string
  status: CycleStatus
  questionCount: number
  challengeCount: number
  submissionCount: number
}
