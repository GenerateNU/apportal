import { useQuery } from '@tanstack/react-query'
import { getChallengeScore } from '@/generated/applicants/applicants'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ChallengeScore } from '@/lib/api/types'
import { queryKeys } from './keys'

// null body is a real, non-error outcome: the applicant has no finished
// backend-challenge expedition (they may have done the frontend challenge,
// or the challenge database isn't configured).
export function useChallengeScore(nuid: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.challengeScore.detail(nuid),
    queryFn: async () => {
      const score = (await getChallengeScore(
        nuid,
        opts
      )) as ChallengeScore | null
      return score && { ...score, attempts: score.attempts ?? [] }
    },
    enabled: !!nuid,
  })
}
