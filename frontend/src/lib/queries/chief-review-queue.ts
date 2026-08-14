import { useMemo } from 'react'
import type { ApplicationStage, ChiefVote, Role } from '@/lib/api/types'
import { ROLE_COLUMNS } from '@/lib/roles'
import { useApplications } from './applications'
import { useChiefReviewsByApplicationIdBatch } from './chief-reviews'
import { useCurrentUser } from './users'

export type ChiefReviewVoteScope = 'needsVote' | 'all'
export type ChiefReviewVoteValueFilter = 'all' | ChiefVote

export interface ChiefReviewQueueFilters {
  cycleId: string
  role: Role | 'all'
  stage: ApplicationStage | 'all'
  search: string
  voteScope: ChiefReviewVoteScope
  voteValue: ChiefReviewVoteValueFilter
}

// The same filtered, ordered applicant list the chief review queue page
// shows — shared with the detail page so its Next/Previous buttons retrace
// exactly the filtered list a chief opened an applicant from, not the whole
// cycle.
export function useChiefReviewQueue(filters: ChiefReviewQueueFilters) {
  const { data: currentUser } = useCurrentUser()
  const { data: applications = [], isLoading: applicationsLoading } =
    useApplications(
      filters.cycleId
        ? {
            cycle_id: filters.cycleId,
            ...(filters.role !== 'all' && { role: filters.role }),
            ...(filters.stage !== 'all' && { stage: filters.stage }),
            ...(filters.search && { search: filters.search }),
          }
        : undefined
    )

  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )

  const { data: chiefReviewsByApplicationId = {}, isLoading: reviewsLoading } =
    useChiefReviewsByApplicationIdBatch(applicationIds)

  const orderedApplications = useMemo(() => {
    const submitted = (id: string) =>
      !!chiefReviewsByApplicationId[id]?.some(
        (r) => r.reviewer_nuid === currentUser?.nuid && !!r.vote
      )
    const ownVote = (id: string) =>
      chiefReviewsByApplicationId[id]?.find(
        (r) => r.reviewer_nuid === currentUser?.nuid
      )?.vote

    const visible = applications.filter((a) => {
      if (filters.voteScope === 'needsVote' && submitted(a.id)) return false
      if (filters.voteValue !== 'all' && ownVote(a.id) !== filters.voteValue) {
        return false
      }
      return true
    })

    return ROLE_COLUMNS.flatMap((r) => visible.filter((a) => a.role === r))
  }, [
    applications,
    chiefReviewsByApplicationId,
    currentUser?.nuid,
    filters.voteScope,
    filters.voteValue,
  ])

  return {
    orderedApplications,
    isLoading: applicationsLoading || reviewsLoading,
  }
}

export type ChiefReviewQueueFilterParams = Omit<
  ChiefReviewQueueFilters,
  'cycleId'
>

// Encodes the queue's filters onto a URL (only non-default values, to keep
// links to unfiltered applicants clean) so opening an applicant — and paging
// through Next/Previous from there — retraces the same filtered list instead
// of the whole cycle.
export function chiefReviewQueueSearchParams(
  filters: ChiefReviewQueueFilterParams
): string {
  const params = new URLSearchParams()
  if (filters.role !== 'all') params.set('role', filters.role)
  if (filters.stage !== 'all') params.set('stage', filters.stage)
  if (filters.search) params.set('search', filters.search)
  if (filters.voteScope !== 'all') params.set('voteScope', filters.voteScope)
  if (filters.voteValue !== 'all') params.set('voteValue', filters.voteValue)
  return params.toString()
}

// Typed structurally (not `URLSearchParams`) so Next's read-only
// `ReadonlyURLSearchParams` — which omits the mutating methods — satisfies
// it too.
export function parseChiefReviewQueueSearchParams(params: {
  get(name: string): string | null
}): ChiefReviewQueueFilterParams {
  return {
    role: (params.get('role') as Role | null) ?? 'all',
    stage: (params.get('stage') as ApplicationStage | null) ?? 'all',
    search: params.get('search') ?? '',
    voteScope:
      (params.get('voteScope') as ChiefReviewVoteScope | null) ?? 'all',
    voteValue:
      (params.get('voteValue') as ChiefReviewVoteValueFilter | null) ?? 'all',
  }
}
