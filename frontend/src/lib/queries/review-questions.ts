import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createReviewQuestion,
  deleteReviewQuestion,
  listCycleReviewQuestions,
  updateReviewQuestion,
} from '@/generated/review-questions/review-questions'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ReviewQuestion, Role } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useReviewQuestions(
  cycleId: string,
  role?: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.reviewQuestions.list(cycleId, role),
    queryFn: async () =>
      ((await listCycleReviewQuestions(cycleId, { role }, opts)) ??
        []) as ReviewQuestion[],
    enabled: !!cycleId,
  })
}

export function useCreateReviewQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: Parameters<typeof createReviewQuestion>[1]
      opts?: RequestOptions
    }) => createReviewQuestion(vars.cycleId, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviewQuestions.lists(),
      })
    },
  })
}

export function useUpdateReviewQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      body: Parameters<typeof updateReviewQuestion>[1]
      opts?: RequestOptions
    }) => updateReviewQuestion(vars.id, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviewQuestions.lists(),
      })
    },
  })
}

// Persists a full reorder of one cycle/role's review questions in a single
// mutation — same rationale as useReorderQuestions in questions.ts.
export function useReorderReviewQuestions(cycleId: string, role?: Role) {
  const queryClient = useQueryClient()
  const key = queryKeys.reviewQuestions.list(cycleId, role)
  return useMutation({
    mutationFn: async (vars: {
      ordered: ReviewQuestion[]
      opts?: RequestOptions
    }) => {
      await Promise.all(
        vars.ordered.map((question, index) =>
          question.display_order === index
            ? Promise.resolve()
            : updateReviewQuestion(
                question.id,
                { display_order: index },
                vars.opts
              )
        )
      )
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReviewQuestion[]>(key)
      queryClient.setQueryData<ReviewQuestion[]>(
        key,
        vars.ordered.map((question, index) => ({
          ...question,
          display_order: index,
        }))
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useDeleteReviewQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; opts?: RequestOptions }) =>
      deleteReviewQuestion(vars.id, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviewQuestions.lists(),
      })
    },
  })
}
