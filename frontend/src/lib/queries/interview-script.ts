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

function normalizeTrack(
  t: Partial<InterviewScriptChallengeTrack> | undefined,
  label: string
): InterviewScriptChallengeTrack {
  return { label: t?.label ?? label, followUps: t?.followUps ?? [] }
}

export function normalizeScript(s: InterviewScript): InterviewScript {
  const tracks = s.challenge_tracks ?? {}
  return {
    ...s,
    questions: s.questions ?? [],
    post_interview_checklist: s.post_interview_checklist ?? [],
    challenge_tracks: {
      backend: normalizeTrack(tracks.backend, 'Backend'),
      frontend: normalizeTrack(tracks.frontend, 'Frontend'),
    },
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
