import type { Crumb } from '@/components/ui/breadcrumbs'

export type MyWorkPhase =
  | 'reviews'
  | 'interviews'
  | 'interviewReviews'
  | 'preference'
  | 'draft'
  | 'feedback'

export const PHASE_LABEL: Record<MyWorkPhase, string> = {
  reviews: 'Reviews',
  interviews: 'Interviews',
  interviewReviews: 'Interview reviews',
  preference: 'Preference list',
  draft: 'Draft',
  feedback: 'Feedback',
}

export function myWorkCrumbs(phase: MyWorkPhase, current?: string): Crumb[] {
  if (current === undefined) return [{ label: PHASE_LABEL[phase] }]
  return [
    { label: PHASE_LABEL[phase], href: `/reviewer/my-work?phase=${phase}` },
    { label: current },
  ]
}
