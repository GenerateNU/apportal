import type { ChiefReviewDetailVote } from '@/generated/model/chiefReviewDetailVote'

export type ChiefVote = ChiefReviewDetailVote

export const CHIEF_VOTES: {
  value: ChiefVote
  label: string
  key: string
  dot: string
  chip: string
}[] = [
  {
    value: 'strong_interview',
    label: 'Strong interview',
    key: '1',
    dot: 'bg-emerald-600',
    chip: 'border-emerald-600 bg-emerald-50 text-emerald-800',
  },
  {
    value: 'interview',
    label: 'Interview',
    key: '2',
    dot: 'bg-emerald-400',
    chip: 'border-emerald-400 bg-emerald-50 text-emerald-700',
  },
  {
    value: 'neutral',
    label: 'Neutral',
    key: '3',
    dot: 'bg-gray-400',
    chip: 'border-gray-400 bg-gray-50 text-gray-700',
  },
  {
    value: 'no_interview',
    label: 'No interview',
    key: '4',
    dot: 'bg-red-400',
    chip: 'border-red-400 bg-red-50 text-red-700',
  },
  {
    value: 'strong_no_interview',
    label: 'Strong no interview',
    key: '5',
    dot: 'bg-red-600',
    chip: 'border-red-600 bg-red-50 text-red-800',
  },
]

export const CHIEF_VOTE_BY_VALUE = new Map(CHIEF_VOTES.map((v) => [v.value, v]))

const SCORE: Record<ChiefVote, number> = {
  strong_interview: 2,
  interview: 1,
  neutral: 0,
  no_interview: -1,
  strong_no_interview: -2,
}

export function isSplit(votes: (ChiefVote | undefined)[]): boolean {
  const scores = votes
    .filter((v): v is ChiefVote => !!v && v !== 'neutral')
    .map((v) => SCORE[v])
  return scores.some((a) => scores.some((b) => a - b >= 2))
}
