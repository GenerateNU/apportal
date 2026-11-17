import type { Overview, PageViewPage } from '@/generated/model'

export type Step = {
  href: string
  label: string
  also?: (string | { path: string; when: string })[]
  locked?: string
}

export type PhaseStatus = 'done' | 'current' | 'locked'

export type Phase = {
  key: string
  label: string
  steps: Step[]
  status: PhaseStatus
  count: number
  lockedReason?: string
}

type StepPage = Omit<Step, 'locked'>

const PAGES: Record<PageViewPage, StepPage> = {
  positions: {
    href: '/reviewer/cycle/workflow',
    label: 'Openings & process',
    also: ['/reviewer/cycle/positions'],
  },
  team: { href: '/reviewer/cycle/team', label: 'Recruitment team' },
  application_forms: {
    href: '/reviewer/cycle/application',
    label: 'Application forms',
    also: [
      '/reviewer/cycle/forms',
      { path: '/admin/applications', when: 'from=forms' },
    ],
  },
  review_forms: {
    href: '/reviewer/cycle/review-forms',
    label: 'Review forms',
    also: [{ path: '/admin/applications', when: 'from=review-forms' }],
  },
  applicants: { href: '/reviewer/applications', label: 'Applicants' },
  assign_reviewers: {
    href: '/reviewer/cycle/reviews',
    label: 'Assign reviewers',
  },
  review_progress: {
    href: '/reviewer/cycle/reviewing',
    label: 'Reviews & progress',
    also: ['/reviewer/my-reviews'],
  },
  shortlist: { href: '/reviewer/cycle/cutoff', label: 'Shortlist' },
  interview_script: {
    href: '/reviewer/interview-script',
    label: 'Interview script',
  },
  assign_interviewers: {
    href: '/reviewer/cycle/interviewers',
    label: 'Assign interviewers',
  },
  interview_progress: {
    href: '/reviewer/cycle/interviewing',
    label: 'Interviews & progress',
    also: ['/reviewer/my-interviews'],
  },
  preference_lists: {
    href: '/reviewer/preference-lists',
    label: 'Teams & preference lists',
  },
  draft: { href: '/reviewer/draft', label: 'Run the draft' },
  feedback: { href: '/reviewer/decisions', label: 'Write & send feedback' },
}

// Which pages a phase has and what is locked come from the backend; this only names and links them.
export function toPhases(view: Overview | undefined): Phase[] {
  return (view?.phases ?? []).map((p) => ({
    key: p.key,
    label: p.label,
    status: (p.status === 'open' ? 'current' : p.status) as PhaseStatus,
    count: p.applicant_count,
    lockedReason: p.locked_reason,
    steps: (p.pages ?? []).map(({ page, locked_reason }) => ({
      ...PAGES[page],
      locked: locked_reason,
    })),
  }))
}

export function stepActive(pathname: string, search: string, step: Step) {
  const [path, query] = step.href.split('?')
  const matches = (h: string) => pathname === h || pathname.startsWith(h + '/')
  const also = (step.also ?? []).some((a) =>
    typeof a === 'string'
      ? matches(a)
      : matches(a.path) && search.includes(a.when)
  )
  if (query) return (pathname === path && search.includes(query)) || also
  return matches(path) || also
}
