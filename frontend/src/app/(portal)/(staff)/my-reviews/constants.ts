// A draft row exists as soon as "Save draft" is pressed, so "in progress" is
// a real state rather than a guess.
export type ReviewState = 'none' | 'draft' | 'submitted'

// Greens are the pair `stageBadge` uses for 'accepted'; `text-status-open`
// (#22c55e) is a dot colour and reads too light as 12px text.
export const REVIEW_STATE_BADGE: Record<ReviewState, string> = {
  none: 'bg-gray-100 text-gray-500',
  draft: 'bg-amber-50 text-amber-700',
  submitted: 'bg-green-50 text-green-700',
}

// One circle in all three states, filling as it progresses.
export const REVIEW_STATE_DOT: Record<ReviewState, string> = {
  none: 'border-gray-300',
  draft: 'border-amber-400',
  submitted: 'border-green-600 bg-green-600',
}

// For green text on the page background rather than inside a badge.
export const REVIEWED_TEXT = 'text-green-700'

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  none: 'Not started',
  draft: 'In progress',
  submitted: 'Reviewed',
}
