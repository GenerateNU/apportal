import type { DraftStatus } from '@/lib/api/types'

// The house card and section-header vocabulary, same as the applicant
// overview's — the draft is a new page, not a new look.
export const SECTION_CLASS =
  'flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm'
export const SECTION_HEADER_CLASS =
  'text-text-faint text-xs font-semibold tracking-wide uppercase'

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
