import type { CurrentUser } from '@/lib/api/types'

export type Role = 'applicant' | 'reviewer' | 'admin'

type RoleSource = Pick<CurrentUser, 'roles' | 'staff'>

// Admin and applicant are global roles; anyone on some cycle's staff (as a
// lead or chief) is a reviewer.
export function getRoles(user: RoleSource): Role[] {
  const roles = new Set<Role>()
  for (const role of user.roles) {
    if (role === 'admin') roles.add('admin')
    else if (role === 'applicant') roles.add('applicant')
  }
  if ((user.staff ?? []).length > 0) roles.add('reviewer')
  return [...roles]
}

// Admins, or a chief on at least one cycle. Gates chief-only pages; the
// backend still checks the specific cycle on every request.
export function hasChiefAccess(user: RoleSource | null | undefined): boolean {
  if (!user) return false
  return (
    user.roles.includes('admin') ||
    (user.staff ?? []).some((s) => s.role === 'chief')
  )
}

// Admins, or a lead or chief on at least one cycle.
export function hasReviewerAccess(
  user: RoleSource | null | undefined
): boolean {
  if (!user) return false
  return user.roles.includes('admin') || (user.staff ?? []).length > 0
}

// The landing page ("portal") for a user, based on the roles they hold. Users
// with multiple roles land on the most privileged staff surface first.
export function defaultDashboard(roles: Role[]): string {
  if (roles.includes('reviewer')) return '/applicant/applications'
  if (roles.includes('admin')) return '/admin/applications'
  if (roles.includes('applicant')) return '/applicant/applications'
  return '/login'
}
