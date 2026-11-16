import { cookies } from 'next/headers'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getServerSession } from '@/lib/api/server-request-options'
import { getServerCurrentUser } from '@/lib/auth/server-user'
import { listMyCycles } from '@/generated/cycle-staff/cycle-staff'
import type { CycleStaff } from '@/generated/model'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { fetchBranches } from '@/lib/queries/branches'
import { fetchCycles } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { fetchRoles } from '@/lib/queries/roles'
import { SIDEBAR_COLLAPSED_COOKIE } from '@/lib/sidebar'
import { PortalShell } from './PortalShell'

// Seeds what the sidebar reads. Pages prefetch some of the same lists, but the
// sidebar renders first, and React Query only hydrates a page's copy on the
// client then — so without these the server and client disagree.
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = new QueryClient()
  const [session, cookieStore] = await Promise.all([
    getServerSession(),
    cookies(),
  ])
  if (session) {
    const opts = await getServerRequestOptions()
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.users.me(session.user.id),
        queryFn: getServerCurrentUser,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.cycleStaff.mine(),
        queryFn: async () => ((await listMyCycles(opts)) ?? []) as CycleStaff[],
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.cycles.list(),
        queryFn: () => fetchCycles(undefined, opts),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.roles.list(),
        queryFn: () => fetchRoles(opts),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.branches.list(),
        queryFn: () => fetchBranches(opts),
      }),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PortalShell
        initialSidebarCollapsed={
          cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === 'true'
        }
      >
        {children}
      </PortalShell>
    </HydrationBoundary>
  )
}
