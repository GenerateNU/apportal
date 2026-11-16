import type { AssignmentKind, StepName } from '@/lib/queries/pipeline'

export const PIPELINE_STEPS: StepName[] = [
  'applications',
  'reviews',
  'interviews',
  'decisions',
  'feedback',
]

export const STEP_SETTING: Partial<
  Record<StepName, { kind: AssignmentKind; unit: string; defaultCount: number }>
> = {
  reviews: { kind: 'reviewer', unit: 'reviewers each', defaultCount: 3 },
  interviews: {
    kind: 'interviewer',
    unit: 'interviewers each',
    defaultCount: 2,
  },
}

export const RECORDING_SETTING = {
  kind: 'recording_reviewer' as const,
  unit: 'reviewers each',
  defaultCount: 1,
}

export const STEP_LABEL: Record<StepName, string> = {
  applications: 'Open applications',
  reviews: 'Review applications',
  interviews: 'Interviews',
  decisions: 'Decisions',
  feedback: 'Feedback',
}

export const STEP_DESCRIPTION: Record<StepName, string> = {
  applications: 'Applicants fill out the form until the deadline',
  reviews: 'Reviewers score each applicant, then you pick who advances',
  interviews: 'The applicants you advanced get interviewed',
  decisions: 'Teams rank applicants, then take turns drafting',
  feedback: 'Everyone hears back, accepted or not',
}
