import type { ApplicationStage, Role } from '@/lib/api/types'

export type { ApplicationStage } from '@/lib/api/types'

export type ApplicantApplication = {
  id: string
  fullName: string
  nuid: string
  email: string
  role: Role
  cycleId: string
  stage: ApplicationStage
  submittedAt: string
}
