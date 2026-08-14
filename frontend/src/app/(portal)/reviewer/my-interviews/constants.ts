import type { ReviewState } from '../my-reviews/constants'

// Same three states as a written review — a draft exists as soon as the
// interviewer saves notes without submitting — just labelled for interviews.
export const INTERVIEW_STATE_LABEL: Record<ReviewState, string> = {
  none: 'Not started',
  draft: 'In progress',
  submitted: 'Interviewed',
}
