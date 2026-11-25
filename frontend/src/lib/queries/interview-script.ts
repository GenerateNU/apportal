import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInterviewScript,
  updateInterviewScript,
} from '@/generated/interview-script/interview-script'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type {
  InterviewScript,
  InterviewScriptChallengeTrack,
} from '@/lib/api/types'
import { queryKeys } from './keys'

type RawTrack = Partial<InterviewScriptChallengeTrack> | null | undefined

function normalizeTrack(t: RawTrack): InterviewScriptChallengeTrack {
  return { label: t?.label ?? '', followUps: t?.followUps ?? [] }
}

function normalizeTracks(raw: unknown): InterviewScriptChallengeTrack[] {
  const list: RawTrack[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw)
      : []
  return list
    .map(normalizeTrack)
    .filter((t) => t.label || t.followUps.some(Boolean))
}

export function normalizeScript(s: InterviewScript): InterviewScript {
  return {
    ...s,
    questions: s.questions ?? [],
    post_interview_checklist: s.post_interview_checklist ?? [],
    challenge_tracks: normalizeTracks(s.challenge_tracks),
  }
}

export function useInterviewScript(
  cycleId: string,
  roleId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewScript.detail(cycleId, roleId),
    queryFn: async () =>
      normalizeScript(
        (await getInterviewScript(
          cycleId,
          { role_id: roleId },
          opts
        )) as InterviewScript
      ),
    enabled: !!cycleId && !!roleId,
  })
}

export function useUpdateInterviewScript() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      roleId: string
      body: Parameters<typeof updateInterviewScript>[1]
      opts?: RequestOptions
    }) =>
      updateInterviewScript(
        vars.cycleId,
        vars.body,
        { role_id: vars.roleId },
        vars.opts
      ),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        queryKeys.interviewScript.detail(vars.cycleId, vars.roleId),
        normalizeScript(data as InterviewScript)
      )
    },
  })
}
