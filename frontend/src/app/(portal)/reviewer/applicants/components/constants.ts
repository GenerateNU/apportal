import type { ElementType } from 'react'
import { GraduationCap, Hash, Star } from 'lucide-react'
import { mockApplicants } from '@/lib/mock-applicants'
import type { ApplicationStage, Rating } from '@/types/applicant'

export type FilterKey = 'major' | 'year' | 'rating'

export const ORDERED_STAGES: ApplicationStage[] = ['application', 'interview', 'offered', 'rejected']

export const FILTER_STAGES: { label: string; value: ApplicationStage | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Application', value: 'application' },
  { label: 'Interview', value: 'interview' },
  { label: 'Offered', value: 'offered' },
  { label: 'Rejected', value: 'rejected' },
]

export const stageBadge: Record<ApplicationStage, string> = {
  application: 'bg-blue-50 text-blue-700',
  interview: 'bg-yellow-50 text-yellow-700',
  offered: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

export const stageLabel: Record<ApplicationStage, string> = {
  application: 'Application',
  interview: 'Interview',
  offered: 'Offered',
  rejected: 'Rejected',
}

export const stageDot: Record<ApplicationStage, string> = {
  application: 'bg-blue-500',
  interview: 'bg-amber-400',
  offered: 'bg-green-500',
  rejected: 'bg-red-400',
}

export const ratingBadge: Record<Rating, string> = {
  no_hire: 'bg-red-50 text-red-700',
  good_hire: 'bg-yellow-50 text-yellow-700',
  great_hire: 'bg-blue-50 text-blue-700',
  must_hire: 'bg-green-50 text-green-700',
}

export const ratingLabel: Record<Rating, string> = {
  no_hire: 'No Hire',
  good_hire: 'Good Hire',
  great_hire: 'Great Hire',
  must_hire: 'Must Hire',
}

export const ratedStages: ApplicationStage[] = ['interview', 'offered', 'rejected']

export const ALL_RATINGS: Rating[] = ['no_hire', 'good_hire', 'great_hire', 'must_hire']
export const ALL_MAJORS = [...new Set(mockApplicants.map((a) => a.major))].sort()
export const ALL_YEARS = [...new Set(mockApplicants.map((a) => a.year))].sort((a, b) => a - b)

export const FILTER_FIELDS: { key: FilterKey; label: string; Icon: ElementType }[] = [
  { key: 'major', label: 'Major', Icon: GraduationCap },
  { key: 'year', label: 'Year', Icon: Hash },
  { key: 'rating', label: 'Rating', Icon: Star },
]
