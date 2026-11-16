import type { CycleStatus } from '@/lib/api/types'

// Mirrors the backend's release rule, so the choice is greyed out instead of
// silently refused.
export function statusBlockedReason(
  mode: 'application' | 'review',
  next: CycleStatus,
  applicationStatus: CycleStatus
): string | null {
  if (mode === 'review' && next === 'open' && applicationStatus !== 'closed') {
    return 'Reviews open once applications close'
  }
  return null
}
