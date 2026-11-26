import { toCycleTemplate } from '@/lib/cycle-paths'
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
    href: '/cycle/process',
    label: 'Openings & process',
  },
  team: { href: '/cycle/team', label: 'Recruitment team' },
  application_forms: {
    href: '/cycle/application-forms',
    label: 'Application forms',
    also: [{ path: '/admin/applications', when: 'from=forms' }],
  },
  review_forms: {
    href: '/cycle/review-forms',
    label: 'Review forms',
    also: [{ path: '/admin/applications', when: 'from=review-forms' }],
  },
  applicants: { href: '/cycle/applicants', label: 'Applicants' },
  assign_reviewers: {
    href: '/cycle/assign-reviewers',
    label: 'Assign reviewers',
  },
  review_progress: {
    href: '/cycle/reviews',
    label: 'Reviews & progress',
    also: ['/my-reviews'],
  },
  shortlist: { href: '/cycle/shortlist', label: 'Shortlist' },
  interview_script: {
    href: '/cycle/interview-script',
    label: 'Interview script',
  },
  assign_interviewers: {
    href: '/cycle/assign-interviewers',
    label: 'Assign interviewers',
  },
  interview_progress: {
    href: '/cycle/interviews',
    label: 'Interviews & progress',
    also: ['/my-interviews'],
  },
  preference_lists: {
    href: '/cycle/teams',
    label: 'Teams & preference lists',
  },
  draft: { href: '/cycle/draft', label: 'Run the draft' },
  feedback: { href: '/cycle/feedback', label: 'Write & send feedback' },
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

export function stepActive(rawPathname: string, search: string, step: Step) {
  const pathname = toCycleTemplate(rawPathname)
  const [path, query] = toCycleTemplate(step.href).split('?')
  const matches = (h: string) => pathname === h || pathname.startsWith(h + '/')
  const also = (step.also ?? []).some((a) =>
    typeof a === 'string'
      ? matches(a)
      : matches(a.path) && search.includes(a.when)
  )
  if (query) return (pathname === path && search.includes(query)) || also
  return matches(path) || also
}
