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

export const RATING_COLORS: Record<
  InterviewRating,
  { bg: string; text: string }
> = {
  must_hire: { bg: 'bg-green-100', text: 'text-green-700' },
  great: { bg: 'bg-teal-100', text: 'text-teal-700' },
  good: { bg: 'bg-blue-100', text: 'text-blue-700' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-700' },
  do_not_hire: { bg: 'bg-red-100', text: 'text-red-700' },
}
