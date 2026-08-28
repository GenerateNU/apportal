import type { PreferenceListStatus } from '@/lib/api/types'

export const PREFERENCE_LIST_STATUS_BADGE: Record<
  PreferenceListStatus,
  string
> = {
  draft: 'bg-gray-100 text-gray-500',
  submitted: 'bg-green-50 text-green-700',
}

export const PREFERENCE_LIST_STATUS_LABEL: Record<
  PreferenceListStatus,
  string
> = {
  draft: 'Draft',
  submitted: 'Submitted',
}
