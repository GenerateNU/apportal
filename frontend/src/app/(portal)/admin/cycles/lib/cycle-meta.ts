import type { CycleStatus } from '@/lib/api/types'

export const CYCLE_STATUS: Record<
  CycleStatus,
  { label: string; dot: string; badge: string }
> = {
  draft: {
    label: 'Draft',
    dot: 'bg-status-draft',
    badge: 'bg-status-draft/15 text-text-muted',
  },
  open: {
    label: 'Open',
    dot: 'bg-status-open',
    badge: 'bg-status-open/15 text-status-open',
  },
  closed: {
    label: 'Closed',
    dot: 'bg-status-closed',
    badge: 'bg-status-closed/15 text-status-closed',
  },
  archived: {
    label: 'Archived',
    dot: 'bg-status-archived',
    badge: 'bg-status-archived/20 text-text-muted',
  },
}

export const CYCLE_STATUS_ORDER: CycleStatus[] = [
  'draft',
  'open',
  'closed',
  'archived',
]

// application_type is a separate enum from applicant role (member/lead/chief).
export const APPLICATION_TYPES = [
  { value: 'member', label: 'Member' },
  { value: 'lead', label: 'Lead' },
  { value: 'chief', label: 'Chief' },
] as const

export type ApplicationType = (typeof APPLICATION_TYPES)[number]['value']

export const APPLICATION_TYPE_LABEL: Record<ApplicationType, string> = {
  member: 'Member',
  lead: 'Lead',
  chief: 'Chief',
}
