import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createQuestion,
  deleteQuestion,
  getQuestions,
  updateQuestion,
} from '@/lib/api/questions'
import type { FetchOptions } from '@/lib/api/client'
import type { Role } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useQuestions(
  cycleId: string,
  role?: Role,
  opts?: FetchOptions
) {
  return useQuery({
    queryKey: queryKeys.questions.list(cycleId, role),
    queryFn: () => getQuestions(cycleId, role, opts),
    enabled: !!cycleId,
  })
}

export function useCreateQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: Parameters<typeof createQuestion>[1]
      opts?: FetchOptions
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
      opts?: FetchOptions
    }) => updateQuestion(vars.id, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.lists() })
    },
  })
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; opts?: FetchOptions }) =>
      deleteQuestion(vars.id, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.lists() })
    },
  })
}
