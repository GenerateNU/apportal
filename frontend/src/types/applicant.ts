export type ApplicationStage =
  | 'application'
  | 'interview'
  | 'offered'
  | 'rejected'

export type Rating = 'no_hire' | 'good_hire' | 'great_hire' | 'must_hire'

export interface Applicant {
  id: string
  firstName: string
  lastName: string
  nuid: string
  email: string
  major: string
  year: number
  stage: ApplicationStage
  rating?: Rating
  submittedAt: string
}
