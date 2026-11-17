import { useQuery } from '@tanstack/react-query'
import { getApplicant } from '@/generated/applicants/applicants'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Applicant } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useApplicant(nuid: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.applicants.detail(nuid),
    queryFn: () => getApplicant(nuid, opts) as Promise<Applicant>,
    enabled: !!nuid,
  })
}
