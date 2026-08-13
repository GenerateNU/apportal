import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { queryKeys } from './keys'

// Regression test for a real bug: casting a chief vote from the detail page
// left the queue's "X/N chiefs reviewed" count stale. The queue's bulk query
// has no mounted observer while you're on the detail page, so invalidating
// it with the default refetchType ('active') only flags it stale without
// actually refetching — it would stay wrong until something else happened to
// remount it. refetchType: 'all' forces the refetch immediately, regardless
// of whether anything is currently observing the query.
describe('chief review vote invalidation', () => {
  it('refetches an inactive bulk query when refetchType is "all"', async () => {
    const queryClient = new QueryClient()
    const applicationIds = ['app-1', 'app-2']
    const bulkQueryFn = vi
      .fn()
      .mockResolvedValueOnce({ 'app-1': [], 'app-2': [] })
      .mockResolvedValueOnce({
        'app-1': [{ reviewer_nuid: 'chief-1', vote: 'interview' }],
        'app-2': [],
      })

    await queryClient.fetchQuery({
      queryKey: queryKeys.chiefReviews.bulk(applicationIds),
      queryFn: bulkQueryFn,
    })
    expect(bulkQueryFn).toHaveBeenCalledTimes(1)

    // No component observes this query right now — simulates having
    // navigated away to the applicant's detail page to cast a vote.
    expect(
      queryClient
        .getQueryCache()
        .find({
          queryKey: queryKeys.chiefReviews.bulk(applicationIds),
        })
        ?.getObserversCount()
    ).toBe(0)

    await queryClient.invalidateQueries({
      queryKey: queryKeys.chiefReviews.all,
      refetchType: 'all',
    })

    expect(bulkQueryFn).toHaveBeenCalledTimes(2)
    expect(
      queryClient.getQueryData(queryKeys.chiefReviews.bulk(applicationIds))
    ).toEqual({
      'app-1': [{ reviewer_nuid: 'chief-1', vote: 'interview' }],
      'app-2': [],
    })
  })

  it('does NOT refetch an inactive query with the default refetchType', async () => {
    const queryClient = new QueryClient()
    const applicationIds = ['app-1']
    const bulkQueryFn = vi.fn().mockResolvedValue({ 'app-1': [] })

    await queryClient.fetchQuery({
      queryKey: queryKeys.chiefReviews.bulk(applicationIds),
      queryFn: bulkQueryFn,
    })

    // Default refetchType ('active') — demonstrates the bug this test
    // guards against: without refetchType: 'all', an inactive query is only
    // marked stale, not actually refetched.
    await queryClient.invalidateQueries({
      queryKey: queryKeys.chiefReviews.all,
    })

    expect(bulkQueryFn).toHaveBeenCalledTimes(1)
    expect(
      queryClient
        .getQueryCache()
        .find({
          queryKey: queryKeys.chiefReviews.bulk(applicationIds),
        })
        ?.isStale()
    ).toBe(true)
  })
})
