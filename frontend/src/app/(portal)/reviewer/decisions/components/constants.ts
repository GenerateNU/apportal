import type {
  ApplicationStage,
  DecisionKind,
  DecisionRow,
  DecisionStatus,
} from '@/lib/api/types'
import type { ReviewState } from '../../my-reviews/constants'

export const KIND_LABEL: Record<DecisionKind, string> = {
  rejection_post_interview: 'Post-interview',
  rejection_generic: 'No interview',
}

export const KIND_DESCRIPTION: Record<DecisionKind, string> = {
  rejection_post_interview:
    'Includes the interviewer’s feedback and compliments. Sent to applicants who interviewed.',
  rejection_generic:
    'The same letter without that paragraph. Sent to applicants who did not interview.',
}

// Same palette as REVIEW_STATE_BADGE in my-reviews/constants.ts, so a status
// chip reads the same across the pipeline pages.
export const STATUS_BADGE: Record<DecisionStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  ready: 'bg-blue-50 text-blue-700',
  sent: 'bg-green-50 text-green-700',
}

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  pending: 'Needs feedback',
  ready: 'Ready to send',
  sent: 'Sent',
}

// The list covers everyone who isn't accepted or withdrawn, which during a
// live cycle includes applicants still being considered. Their message renders
// like any other, so the row says so plainly — sending one early is not a
// mistake this page should make easy.
export function isDecided(stage: ApplicationStage) {
  return stage === 'rejected'
}

// How far a lead has got on one applicant's paragraphs, in the same three
// states their review and interview queues use — so the queue row, its dot,
// and its badge all come from the shared ReviewRow without a parallel vocabulary.
export function feedbackState(row: DecisionRow): ReviewState {
  if (row.status !== 'pending') return 'submitted'
  return row.feedback || row.compliments ? 'draft' : 'none'
}

export const FEEDBACK_STATE_LABEL: Record<ReviewState, string> = {
  none: 'Not written',
  draft: 'In progress',
  submitted: 'Written',
}
