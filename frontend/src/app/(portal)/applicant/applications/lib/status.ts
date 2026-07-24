import type { ApplicationStage } from '@/lib/api/types'

// How each pipeline stage reads to the applicant. The internal review stages
// (lead_review … selection) all surface as a single "Under review" so applicants
// don't see the machinery.
export const APPLICANT_STATUS: Record<
  ApplicationStage,
  { label: string; className: string }
> = {
  draft: {
    label: 'Draft',
    className: 'bg-status-archived/15 text-status-archived',
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-status-open/15 text-status-open',
  },
  lead_review: {
    label: 'Under review',
    className: 'bg-chip-3-bg text-chip-3-text',
  },
  chief_review: {
    label: 'Under review',
    className: 'bg-chip-3-bg text-chip-3-text',
  },
  interview_scheduled: {
    label: 'Interview scheduled',
    className: 'bg-chip-4-bg text-chip-4-text',
  },
  interview_conducted: {
    label: 'Under review',
    className: 'bg-chip-3-bg text-chip-3-text',
  },
  interview_review: {
    label: 'Under review',
    className: 'bg-chip-3-bg text-chip-3-text',
  },
  selection: {
    label: 'Under review',
    className: 'bg-chip-3-bg text-chip-3-text',
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-status-open/15 text-status-open',
  },
  rejected: {
    label: 'Not selected',
    className: 'bg-status-closed/15 text-status-closed',
  },
  withdrawn: {
    label: 'Withdrawn',
    className: 'bg-status-archived/15 text-status-archived',
  },
}
