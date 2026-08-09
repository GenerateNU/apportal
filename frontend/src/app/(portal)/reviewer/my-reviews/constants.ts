// Where this lead's own review of an application has got to. A draft row
// exists as soon as "Save draft" is pressed, so "in progress" is a real state
// the queue can report rather than a guess.
export type ReviewState = 'none' | 'draft' | 'submitted'

// Badge/icon colours for each state, shared by the queue rows and the review
// page's header pill so the two can't drift apart. The greens are the pair
// `stageBadge` uses for 'accepted' — the older `text-status-open` (#22c55e) is
// a dot colour and reads too light as 12px text.
export const REVIEW_STATE_BADGE: Record<ReviewState, string> = {
  none: 'bg-gray-100 text-gray-500',
  draft: 'bg-amber-50 text-amber-700',
  submitted: 'bg-green-50 text-green-700',
}

// One 16px circle in all three states, so a lead scanning the column sees a
// single shape whose fill tracks progress — hollow, ringed, solid — rather
// than a glyph that changes identity at the finish line. Matches every other
// status indicator in the portal (cycleStatusDot, stageDot, the apply card).
export const REVIEW_STATE_DOT: Record<ReviewState, string> = {
  none: 'border-gray-300',
  draft: 'border-amber-400',
  submitted: 'border-green-600 bg-green-600',
}

// For green text sat on the page background rather than inside a badge.
export const REVIEWED_TEXT = 'text-green-700'

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  none: 'Not started',
  draft: 'In progress',
  submitted: 'Reviewed',
}
