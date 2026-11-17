import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { listInterviewReviewersBulk } from '@/generated/interview-assignments/interview-assignments'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { InterviewReviewer } from '@/lib/api/types'
import { chunkIds } from './interviews'
import { queryKeys } from './keys'

export function useInterviewReviewersBulk(
  applicationIds: string[],
  opts?: RequestOptions
) {
  const batches = useMemo(() => chunkIds(applicationIds), [applicationIds])
  const queries = useQueries({
    queries: batches.map((ids) => ({
      queryKey: queryKeys.interviewReviewAssignments.bulk(ids),
      queryFn: async () => {
        const reviewers = ((await listInterviewReviewersBulk(
          { application_ids: ids.join(',') },
          opts
        )) ?? []) as InterviewReviewer[]
        const byApplicationId: Record<string, InterviewReviewer[]> = {}
        for (const id of ids) byApplicationId[id] = []
        for (const reviewer of reviewers) {
          byApplicationId[reviewer.application_id]?.push(reviewer)
        }
        return byApplicationId
      },
    })),
  })
  const data = useMemo(() => {
    if (queries.some((q) => !q.data)) return undefined
    return Object.assign({}, ...queries.map((q) => q.data)) as Record<
      string,
      InterviewReviewer[]
    >
  }, [queries])
  return { data, isLoading: queries.some((q) => q.isLoading) }
}
