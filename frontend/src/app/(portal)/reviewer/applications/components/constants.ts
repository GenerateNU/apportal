import type { ApplicationStage } from '@/lib/api/types'

export const ORDERED_STAGES: ApplicationStage[] = [
  'submitted',
  'lead_review',
  'chief_review',
  'interview',
  'interview_scheduled',
  'interview_conducted',
  'interview_review',
  'selection',
  'accepted',
  'rejected',
  'withdrawn',
]

export const FILTER_STAGES: {
  label: string
  value: ApplicationStage | 'all'
}[] = [
  { label: 'All', value: 'all' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Lead Review', value: 'lead_review' },
  { label: 'Chief Review', value: 'chief_review' },
  { label: 'Interview', value: 'interview' },
  { label: 'Interview Scheduled', value: 'interview_scheduled' },
  { label: 'Interview Conducted', value: 'interview_conducted' },
  { label: 'Interview Review', value: 'interview_review' },
  { label: 'Selection', value: 'selection' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
]

// Reviewers never see 'draft' applications (filtered out server-side) — these
// entries exist only so the Record stays exhaustive against ApplicationStage.
export const stageBadge: Record<ApplicationStage, string> = {
  draft: 'bg-gray-100 text-gray-500',
  submitted: 'bg-blue-50 text-blue-700',
  lead_review: 'bg-purple-50 text-purple-700',
  chief_review: 'bg-indigo-50 text-indigo-700',
  interview: 'bg-pink-50 text-pink-700',
  interview_scheduled: 'bg-yellow-50 text-yellow-700',
  interview_conducted: 'bg-orange-50 text-orange-700',
  interview_review: 'bg-amber-50 text-amber-700',
  selection: 'bg-cyan-50 text-cyan-700',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
}

export const stageLabel: Record<ApplicationStage, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  lead_review: 'Lead Review',
  chief_review: 'Chief Review',
  interview: 'Interview',
  interview_scheduled: 'Interview Scheduled',
  interview_conducted: 'Interview Conducted',
  interview_review: 'Interview Review',
  selection: 'Selection',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export const stageDot: Record<ApplicationStage, string> = {
  draft: 'bg-gray-300',
  submitted: 'bg-blue-500',
  lead_review: 'bg-purple-500',
  chief_review: 'bg-indigo-500',
  interview: 'bg-pink-500',
  interview_scheduled: 'bg-yellow-400',
  interview_conducted: 'bg-orange-400',
  interview_review: 'bg-amber-400',
  selection: 'bg-cyan-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-400',
  withdrawn: 'bg-gray-300',
}

// Same hues as stageDot, for the text label sat next to the dot.
export const stageTextColor: Record<ApplicationStage, string> = {
  draft: 'text-gray-500',
  submitted: 'text-blue-700',
  lead_review: 'text-purple-700',
  chief_review: 'text-indigo-700',
  interview: 'text-pink-700',
  interview_scheduled: 'text-yellow-700',
  interview_conducted: 'text-orange-700',
  interview_review: 'text-amber-700',
  selection: 'text-cyan-700',
  accepted: 'text-green-700',
  rejected: 'text-red-700',
  withdrawn: 'text-gray-500',
}
