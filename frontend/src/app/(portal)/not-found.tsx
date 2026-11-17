import Link from 'next/link'
import { PageContainer } from '@/components/PageContainer'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import {
  getServerCurrentUser,
  getServerStaffAccess,
} from '@/lib/auth/server-user'
import { defaultDashboard, getRoles } from '@/types/roles'

async function homeHref(): Promise<string> {
  try {
    const [user, access] = await Promise.all([
      getServerCurrentUser(),
      getServerStaffAccess(),
    ])
    return defaultDashboard(getRoles(user, access.isStaff))
  } catch {
    return '/'
  }
}

export default async function PortalNotFound() {
  const home = await homeHref()
  return (
    <PageContainer>
      <PageHeader title="Page not found" />
      <EmptyState
        title="This page doesn't exist, or you don't have access to it."
        action={
          <Link href={home} className={buttonVariants()}>
            Back to home
          </Link>
        }
      />
    </PageContainer>
  )
}
