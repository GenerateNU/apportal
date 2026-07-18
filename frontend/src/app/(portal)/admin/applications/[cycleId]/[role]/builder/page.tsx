import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getCycle } from '@/generated/cycles/cycles'
import { listCycleQuestions } from '@/generated/questions/questions'
import type { Role } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { FormBuilderClient } from './components/FormBuilderClient'

const VALID_ROLES: Role[] = ['software_engineer', 'software_designer']

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ cycleId: string; role: string }>
}) {
  const { cycleId, role } = await params
  if (!VALID_ROLES.includes(role as Role)) {
    notFound()
  }
  const validRole = role as Role

  const queryClient = new QueryClient()

  const cycle = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.detail(cycleId),
    queryFn: () => getCycle(cycleId, { actor: REVIEWER_ACTOR }),
  })

  await queryClient.prefetchQuery({
    queryKey: queryKeys.questions.list(cycleId, validRole),
    queryFn: () =>
      listCycleQuestions(
        cycleId,
        { role: validRole },
        { actor: REVIEWER_ACTOR }
      ),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FormBuilderClient
        cycleId={cycleId}
        cycleName={cycle.name}
        role={validRole}
      />
    </HydrationBoundary>
  )
}
