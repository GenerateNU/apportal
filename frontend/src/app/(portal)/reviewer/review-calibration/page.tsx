import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycles } from '@/generated/cycles/cycles'
import { listCycleReviewQuestions } from '@/generated/review-questions/review-questions'
import { listReviewQuestionAverages } from '@/generated/review-releases/review-releases'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { ROLE_COLUMNS } from '@/lib/roles'
import { ReviewCalibrationClient } from './components/ReviewCalibrationClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Chief/admin only. The sidebar hides this link from leads, but that alone
// leaves the route reachable by URL, so the check is repeated here on the
// server. The backend is still the actual boundary —
// list-review-question-averages calls requireChief — this just avoids
// rendering a page whose every request would 403.
async function isChief(): Promise<boolean> {
  try {
    const user = await getCurrentUser(await getServerRequestOptions())
    return (user.roles ?? []).some(
      (role) => role === 'chief' || role === 'admin'
    )
  } catch {
    return false
  }
}

export default async function ReviewCalibrationPage() {
  if (!(await isChief())) notFound()

  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const cycles = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.list({}),
    queryFn: async () => (await listCycles({}, requestOptions)) ?? [],
  })
  const cycleId = pickDefaultCycleId(cycles)

  await Promise.all(
    cycleId
      ? ROLE_COLUMNS.flatMap((role) => [
          queryClient.prefetchQuery({
            queryKey: queryKeys.reviewQuestions.list(cycleId, role),
            queryFn: async () =>
              (await listCycleReviewQuestions(
                cycleId,
                { role },
                requestOptions
              )) ?? [],
          }),
          queryClient.prefetchQuery({
            queryKey: queryKeys.reviewQuestionAverages.list(cycleId, role),
            queryFn: async () =>
              (await listReviewQuestionAverages(
                cycleId,
                { role },
                requestOptions
              )) ?? [],
          }),
        ])
      : []
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewCalibrationClient />
    </HydrationBoundary>
  )
}
