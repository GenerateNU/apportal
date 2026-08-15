import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  updateApplication,
} from '@/generated/applications/applications'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type {
  ApplicationsOutputBody,
  ListApplicationsParams,
} from '@/generated/model'
import type {
  AnswerFilterParam,
  Application,
  ApplicationStage,
  ApplicationSummary,
  Role,
} from '@/lib/api/types'
import { queryKeys } from './keys'

export interface ApplicationListParams {
  cycle_id?: string
  user_nuid?: string
  assigned_to?: string
  // Applications this reviewer is assigned to interview — the interview-side
  // counterpart of assigned_to.
  interviewer_nuid?: string
  // Applications this lead is assigned to review the interview recording of —
  // the reviewer-side counterpart of interviewer_nuid.
  recording_reviewer_nuid?: string
  stage?: ApplicationStage
  role?: Role
  answer_filters?: AnswerFilterParam[]
  // Substring match on the applicant's name, NUID, or email. Server-side
  // because it has to narrow the whole match, not just the fetched page.
  search?: string
  // Omit to fetch every match. Paging is opt-in: the review queues and the
  // assignment planner all need the full set.
  limit?: number
  offset?: number
}

// fetchApplicationPage is the shared queryFn. The cache always holds the whole
// envelope so a paging caller can read `total` and `stage_counts`; hooks that
// only want the rows unwrap it on the way out, which leaves the cached shape
// (and so the server prefetch in each page.tsx) identical for both.
export async function fetchApplicationPage(
  params?: ApplicationListParams,
  opts?: RequestOptions
): Promise<ApplicationsOutputBody> {
  return (await listApplications(
    toListParams(params),
    opts
  )) as ApplicationsOutputBody
}

export function useApplications(
  params?: ApplicationListParams,
  opts?: RequestOptions,
  // `enabled` lets a caller hold the request until its filters are actually
  // known. Omitting a filter isn't the same as not having it yet: the backend
  // ignores empty filter values, so a half-built params object silently
  // fetches every application.
  { enabled = true }: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: queryKeys.applications.list(params),
    queryFn: () => fetchApplicationPage(params, opts),
    select: (data) => (data.applications ?? []) as ApplicationSummary[],
    enabled,
  })
}

// useInfiniteApplications walks the same paged endpoint one offset at a time,
// accumulating rows for a scroll-to-load table. `params` carries the page size
// but never the offset — that comes from the page param, so every filter
// change starts a fresh scroll from the top on its own.
export function useInfiniteApplications(
  params?: ApplicationListParams,
  opts?: RequestOptions,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.applications.infiniteList(params),
    queryFn: ({ pageParam }) =>
      fetchApplicationPage({ ...params, offset: pageParam }, opts),
    initialPageParam: 0,
    // The next offset is however many rows are already in hand; undefined once
    // that reaches the total. Only the first page carries the totals — the
    // server skips those scans on later pages, since they cost more than the
    // page itself and can't change while the filter doesn't.
    getNextPageParam: (_lastPage, allPages) => {
      const loaded = allPages.reduce(
        (sum, p) => sum + (p.applications?.length ?? 0),
        0
      )
      return loaded < (allPages[0]?.total ?? 0) ? loaded : undefined
    },
    enabled,
  })

  const pages = query.data?.pages ?? []
  return {
    ...query,
    applications: pages.flatMap(
      (p) => (p.applications ?? []) as ApplicationSummary[]
    ),
    // Ids grouped the way they were fetched, so anything loaded per-row
    // alongside them (answers) can be batched one request per page instead of
    // one per row — and appending a page leaves earlier batches cached.
    applicationIdPages: pages.map((p) =>
      (p.applications ?? []).map((a) => a.id)
    ),
    total: pages[0]?.total ?? 0,
    stageCounts: pages[0]?.stage_counts ?? {},
  }
}

// answer_filters crosses the wire as a JSON string: it is the one list-of-
// objects param on this endpoint, and neither axios's bracket encoding nor a
// repeated key binds to a struct slice server-side. Everything else passes
// through untouched.
function toListParams(
  params?: ApplicationListParams
): ListApplicationsParams | undefined {
  if (!params) return undefined
  const { answer_filters, ...rest } = params
  if (!answer_filters?.length) return rest
  return { ...rest, answer_filters: JSON.stringify(answer_filters) }
}

export function useApplication(id: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.applications.detail(id),
    queryFn: () => getApplication(id, opts) as Promise<Application>,
    enabled: !!id,
  })
}

export function useCreateApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof createApplication>[0]
      opts?: RequestOptions
    }) => createApplication(vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
    },
  })
}

export function useUpdateApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      body: Parameters<typeof updateApplication>[1]
      opts?: RequestOptions
    }) => updateApplication(vars.id, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.applications.detail(vars.id), data)
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
    },
  })
}

// Discards an applicant's own in-progress draft (owner + draft-only,
// enforced server-side) so they can start over against a fresh form.
export function useDeleteApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; opts?: RequestOptions }) =>
      deleteApplication(vars.id, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.removeQueries({
        queryKey: queryKeys.applications.detail(vars.id),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
    },
  })
}
