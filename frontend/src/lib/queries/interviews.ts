import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  listInterviews,
  listInterviewsBulk,
  upsertInterview,
} from '@/generated/interviews/interviews'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Interview } from '@/lib/api/types'
import { queryKeys } from './keys'

export function primaryInterview(interviews: Interview[] | undefined) {
  return interviews?.find((iv) => !!iv.submitted_at) ?? interviews?.[0]
}

export function useInterviews(applicationId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.interviews.detail(applicationId),
    queryFn: async () =>
      ((await listInterviews(applicationId, opts)) ?? []) as Interview[],
    enabled: !!applicationId,
  })
}

export function useInterviewsByApplicationIdBatches(
  applicationIdBatches: string[][],
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  return useQueries({
    queries: applicationIdBatches.map((applicationIds) => ({
      queryKey: queryKeys.interviews.bulk(applicationIds),
      queryFn: async () => {
        const interviews = ((await listInterviewsBulk(
          { application_ids: applicationIds.join(',') },
          opts
        )) ?? []) as Interview[]

        const byApplicationId: Record<string, Interview[]> = {}
        for (const id of applicationIds) byApplicationId[id] = []
        for (const interview of interviews) {
          const list = byApplicationId[interview.application_id] ?? []
          list.push(interview)
          byApplicationId[interview.application_id] = list
        }
        for (const [id, list] of Object.entries(byApplicationId)) {
          queryClient.setQueryData(queryKeys.interviews.detail(id), list)
        }
        return byApplicationId
      },
      enabled: applicationIds.length > 0,
    })),
  })
}

export function useUpsertInterview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof upsertInterview>[1]
      opts?: RequestOptions
    }) => upsertInterview(vars.applicationId, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      const saved = data as Interview
      queryClient.setQueryData<Interview[]>(
        queryKeys.interviews.detail(vars.applicationId),
        (prev = []) =>
          prev.some((iv) => iv.interviewer_nuid === saved.interviewer_nuid)
            ? prev.map((iv) =>
                iv.interviewer_nuid === saved.interviewer_nuid ? saved : iv
              )
            : [...prev, saved]
      )
      // Submitting may have advanced the application's stage, so the lists
      // (e.g. the chief-review queue) need to catch up too.
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.detail(vars.applicationId),
      })
    },
  })
}
