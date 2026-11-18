import { ErrorScreen } from '@/components/ErrorScreen'
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
  return (
    <ErrorScreen
      code="404"
      title="Page not found"
      message="This page doesn't exist, or you don't have access to it."
      homeHref={await homeHref()}
    />
  )
}
