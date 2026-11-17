import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  createQuestion,
  deleteQuestion,
  listCycleQuestions,
  updateQuestion,
} from '@/generated/questions/questions'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Question } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useQuestions(
  cycleId: string,
  roleId?: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.questions.list(cycleId, roleId),
    queryFn: async () =>
      ((await listCycleQuestions(cycleId, { role_id: roleId }, opts)) ??
        []) as Question[],
    enabled: !!cycleId,
  })
}

export function useQuestionsByCycleRoles(
  pairs: { cycleId: string; roleId: string }[],
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  const cycles = useMemo(() => {
    const byCycle = new Map<string, string[]>()
    for (const { cycleId, roleId } of pairs) {
      if (!cycleId) continue
      byCycle.set(cycleId, [...(byCycle.get(cycleId) ?? []), roleId])
    }
    return [...byCycle.entries()]
  }, [pairs])
  const queries = useQueries({
    queries: cycles.map(([cycleId, roleIds]) => ({
      queryKey: queryKeys.questions.list(cycleId),
      queryFn: async () => {
        const all = ((await listCycleQuestions(cycleId, undefined, opts)) ??
          []) as Question[]
        for (const roleId of roleIds) {
          queryClient.setQueryData(
            queryKeys.questions.list(cycleId, roleId),
            forRole(all, roleId)
          )
        }
        return all
      },
    })),
  })
  return useMemo(() => {
    const byCycleRole: Record<string, Question[]> = {}
    cycles.forEach(([cycleId, roleIds], i) => {
      const all = queries[i]?.data
      if (!all) return
      for (const roleId of roleIds) {
        byCycleRole[`${cycleId}:${roleId}`] = forRole(all, roleId)
      }
    })
    return { byCycleRole, loaded: queries.every((q) => q.isSuccess) }
  }, [cycles, queries])
}

function forRole(questions: Question[], roleId: string) {
  return questions.filter((q) => !q.role_id || q.role_id === roleId)
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
export function useReorderQuestions(cycleId: string, roleId?: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.questions.list(cycleId, roleId)
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
