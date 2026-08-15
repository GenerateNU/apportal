import type { InterviewRating } from '@/lib/api/types'

// Best to worst — the order both the rating picker and the ratings-grouped
// queue display buckets in.
export const RATING_OPTIONS: { value: InterviewRating; label: string }[] = [
  { value: 'must_hire', label: 'Must hire' },
  { value: 'great', label: 'Great hire' },
  { value: 'good', label: 'Good hire' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'do_not_hire', label: 'Do not hire' },
]

export const RATING_LABEL: Record<InterviewRating, string> = Object.fromEntries(
  RATING_OPTIONS.map((o) => [o.value, o.label])
) as Record<InterviewRating, string>
