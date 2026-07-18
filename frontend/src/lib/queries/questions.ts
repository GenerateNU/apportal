import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createQuestion,
  deleteQuestion,
  listCycleQuestions,
  updateQuestion,
} from '@/generated/questions/questions'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Question, Role } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useQuestions(
  cycleId: string,
  role?: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.questions.list(cycleId, role),
    queryFn: async () =>
      ((await listCycleQuestions(cycleId, { role }, opts)) ?? []) as Question[],
    enabled: !!cycleId,
  })
}

// Fetches all questions for each cycle, e.g. to build per-cycle template
// summaries. Each cycle gets its own cache entry, shared with useQuestions.
export function useQuestionsByCycles(
  cycleIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: cycleIds.map((cycleId) => ({
      queryKey: queryKeys.questions.list(cycleId),
      queryFn: async () =>
        ((await listCycleQuestions(cycleId, undefined, opts)) ??
          []) as Question[],
      enabled: !!cycleId,
    })),
  })
}

export function useCreateQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: Parameters<typeof createQuestion>[1]
      opts?: RequestOptions
    }) => createQuestion(vars.cycleId, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions.lists(),
      })
    },
  })
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      body: Parameters<typeof updateQuestion>[1]
      opts?: RequestOptions
    }) => updateQuestion(vars.id, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.lists() })
    },
  })
}

// Persists a full reorder of one cycle/role's questions in a single mutation.
// Reordering by firing one useUpdateQuestion per moved card caused a storm of
// list invalidations mid-drag (each refetch overwrote the in-progress local
// order) with no way to recover if one PATCH failed. This instead optimistically
// rewrites the cached list once, PATCHes only the cards whose position changed,
// rolls the cache back on failure, and invalidates a single time on settle.
export function useReorderQuestions(cycleId: string, role?: Role) {
  const queryClient = useQueryClient()
  const key = queryKeys.questions.list(cycleId, role)
  return useMutation({
    mutationFn: async (vars: {
      ordered: Question[]
      opts?: RequestOptions
    }) => {
      await Promise.all(
        vars.ordered.map((question, index) =>
          question.display_order === index
            ? Promise.resolve()
            : updateQuestion(question.id, { display_order: index }, vars.opts)
        )
      )
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Question[]>(key)
      queryClient.setQueryData<Question[]>(
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

export function useDeleteQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; opts?: RequestOptions }) =>
      deleteQuestion(vars.id, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.lists() })
    },
  })
}
