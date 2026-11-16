import type { DraftStatus } from '@/lib/api/types'

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  setup: 'Setting up',
  active: 'In progress',
  complete: 'Complete',
}

export const DRAFT_STATUS_BADGE: Record<DraftStatus, string> = {
  setup: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  complete: 'bg-blue-100 text-blue-700',
}
