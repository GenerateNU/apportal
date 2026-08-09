import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  updateApplication,
} from '@/generated/applications/applications'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ListApplicationsParams } from '@/generated/model'
import type {
  Application,
  ApplicationStage,
  ApplicationSummary,
  QuestionType,
  Role,
} from '@/lib/api/types'
import { queryKeys } from './keys'

// One answer-based filter. `values` matches any of the given strings; a
// question with several filters is AND'd against the others.
export interface AnswerFilterParam {
  question_id: string
  question_type: QuestionType
  values: string | string[]
}

export function useApplications(
  params?: {
    cycle_id?: string
    user_nuid?: string
    assigned_to?: string
    stage?: ApplicationStage
    role?: Role
    answer_filters?: AnswerFilterParam[]
  },
  opts?: RequestOptions,
  // `enabled` lets a caller hold the request until its filters are actually
  // known. Omitting a filter isn't the same as not having it yet: the backend
  // ignores empty filter values, so a half-built params object silently
  // fetches every application.
  { enabled = true }: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: queryKeys.applications.list(params),
    queryFn: async () =>
      ((await listApplications(toListParams(params), opts)) ??
        []) as ApplicationSummary[],
    enabled,
  })
}

// answer_filters crosses the wire as a JSON string: it is the one list-of-
// objects param on this endpoint, and neither axios's bracket encoding nor a
// repeated key binds to a struct slice server-side. Everything else passes
// through untouched.
function toListParams(
  params?: Parameters<typeof useApplications>[0]
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
