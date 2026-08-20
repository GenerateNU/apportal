import type { ReviewState } from '../my-reviews/constants'

// Same three states as a written review — a draft exists as soon as the
// interviewer saves notes without submitting — just labelled for interviews.
export const INTERVIEW_STATE_LABEL: Record<ReviewState, string> = {
  none: 'Not started',
  draft: 'In progress',
  submitted: 'Interviewed',
}

// The reviewing queue tracks a fourth thing the interviewing one doesn't:
// whether the interviewer has submitted yet, which gates the review entirely.
// Everything after that is about *this* reviewer's own write-up.
export type ReviewingState = 'waiting' | 'ready' | 'draft' | 'submitted'

// Rank orders the queue: what you can act on now, then what will land later,
// then what's done.
export const REVIEWING_STATE: Record<
  ReviewingState,
  { rank: number; badge: ReviewState; label: string; tooltip: string }
> = {
  draft: {
    rank: 0,
    badge: 'draft',
    label: 'In progress',
    tooltip: "You've saved a draft — submit it when you're ready",
  },
  ready: {
    rank: 1,
    badge: 'draft',
    label: 'Ready to review',
    tooltip: 'The interviewer has submitted — you can leave your review',
  },
  waiting: {
    rank: 2,
    badge: 'none',
    label: 'Waiting',
    tooltip: 'Waiting for the interviewer to submit their write-up',
  },
  submitted: {
    rank: 3,
    badge: 'submitted',
    label: 'Reviewed',
    tooltip: "You've submitted your review of this recording",
  },
}
