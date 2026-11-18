import type { CycleStatus } from '@/lib/api/types'

export function releaseBlocker(hasForm: boolean, hasDeadline: boolean) {
  if (!hasForm && !hasDeadline)
    return 'Fill out the form and set a deadline first'
  if (!hasForm) return 'Fill out the form first'
  if (!hasDeadline) return 'Set a deadline first'
  return null
}

// Mirrors the backend's release rule, so the choice is greyed out instead of
// silently refused.
export function statusBlockedReason(
  mode: 'application' | 'review',
  next: CycleStatus,
  applicationStatus: CycleStatus,
  form: { hasQuestions: boolean; hasDeadline: boolean }
): string | null {
  if (mode === 'review' && next === 'open' && applicationStatus !== 'closed') {
    return 'Reviews open once applications close'
  }
  if (
    mode === 'application' &&
    next === 'open' &&
    applicationStatus === 'draft'
  ) {
    return releaseBlocker(form.hasQuestions, form.hasDeadline)
  }
  return null
}
