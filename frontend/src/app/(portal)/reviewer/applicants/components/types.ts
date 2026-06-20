import type { ApplicationStage, Role } from '@/lib/api/types'

export type { ApplicationStage } from '@/lib/api/types'

export type ApplicantApplication = {
  id: string
  fullName: string
  nuid: string
  email: string
  major: string | null
  graduationYear: number | null
  role: Role
  stage: ApplicationStage
  submittedAt: string
}
