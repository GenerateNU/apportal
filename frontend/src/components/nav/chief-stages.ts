import type { Overview } from '@/generated/model'

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
}

export const WRAP_UP_PATH = '/reviewer/cycle/wrap-up'

type StepPage = Omit<Step, 'locked'>

const STEP_PAGES: Record<string, StepPage> = {
  positions: {
    href: '/reviewer/cycle/workflow',
    label: 'Openings & process',
    also: ['/reviewer/cycle/positions'],
  },
  team: { href: '/reviewer/cycle/team', label: 'Recruitment team' },
  open_applications: {
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
  run_reviews: { href: '/reviewer/cycle/reviews', label: 'Assign reviewers' },
  review_progress: {
    href: '/reviewer/cycle/reviewing',
    label: 'Reviews & progress',
    also: ['/reviewer/my-reviews'],
  },
  advance: { href: '/reviewer/cycle/cutoff', label: 'Shortlist' },
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

const STEPS_FOR: Record<string, string[]> = {
  applications: ['open_applications', 'review_forms', 'applicants'],
  reviews: ['run_reviews', 'review_progress', 'advance'],
  interviews: ['interview_script', 'assign_interviewers', 'interview_progress'],
  decisions: ['preference_lists', 'draft', 'wrap_up'],
  feedback: ['feedback', 'wrap_up'],
}

export function toPhases(
  view: Overview | undefined,
  hasOpenings: boolean
): Phase[] {
  if (!view) return []
  const steps = view.steps ?? []
  const applicationsOpen = steps.some(
    (s) =>
      s.step === 'applications' &&
      (s.openings ?? []).some((o) => o.state !== 'draft')
  )
  const setup: Phase = {
    key: 'setup',
    label: 'Setup',
    status: hasOpenings ? 'done' : 'current',
    count: 0,
    steps: [STEP_PAGES.positions, STEP_PAGES.team],
  }
  return [
    setup,
    ...steps.map((s) => ({
      key: s.step,
      label: s.label,
      status: (s.status === 'open' ? 'current' : s.status) as PhaseStatus,
      count: s.applicant_count,
      steps: (STEPS_FOR[s.step] ?? []).map((id) =>
        id === 'wrap_up'
          ? { href: `${WRAP_UP_PATH}?stage=${s.step}`, label: 'Wrap up' }
          : {
              ...STEP_PAGES[id],
              locked:
                id === 'applicants' && !applicationsOpen
                  ? 'Opens once you release an application.'
                  : undefined,
            }
      ),
    })),
  ]
}

export function currentPhaseIndex(phases: Phase[]) {
  const i = phases.findIndex((p) => p.status === 'current')
  return i === -1 ? phases.length - 1 : i
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
