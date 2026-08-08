import type { ChiefVote } from '@/lib/api/types'

// Weakest-no to strongest-yes, the order chiefs expect to scan a ballot in.
export const CHIEF_VOTE_ORDER: ChiefVote[] = [
  'strong_no_interview',
  'no_interview',
  'neutral',
  'interview',
  'strong_interview',
]

export const CHIEF_VOTE_LABEL: Record<ChiefVote, string> = {
  strong_interview: 'Strong interview',
  interview: 'Interview',
  neutral: 'Neutral',
  no_interview: 'No interview',
  strong_no_interview: 'Strong no interview',
}

export const CHIEF_VOTE_BADGE_CLASS: Record<ChiefVote, string> = {
  strong_interview: 'bg-status-open/15 text-status-open',
  interview: 'bg-green-50 text-green-700',
  neutral: 'bg-gray-100 text-gray-600',
  no_interview: 'bg-orange-50 text-orange-700',
  strong_no_interview: 'bg-red-50 text-red-700',
}
