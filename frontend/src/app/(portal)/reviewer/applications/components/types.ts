import type { ApplicationStage } from '@/lib/api/types'

export type { ApplicationStage } from '@/lib/api/types'

export type ApplicantApplication = {
  id: string
  nuid: string
  fullName: string
  email: string
  role: string
  cycleId: string
  stage: ApplicationStage
  submittedAt?: string
  returner: boolean
}
