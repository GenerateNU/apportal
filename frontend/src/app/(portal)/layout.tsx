import { cookies } from 'next/headers'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getServerSession } from '@/lib/api/server-request-options'
import { getServerCurrentUser } from '@/lib/auth/server-user'
import { queryKeys } from '@/lib/queries/keys'
import { SIDEBAR_COLLAPSED_COOKIE } from '@/lib/sidebar'
import { PortalShell } from './PortalShell'

// Seeds /users/me so the sidebar and every useCurrentUser below render on the
// server instead of waiting on a client round trip.
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
    await queryClient.prefetchQuery({
      queryKey: queryKeys.users.me(session.user.id),
      queryFn: getServerCurrentUser,
    })
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
