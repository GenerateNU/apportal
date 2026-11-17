import type { Crumb } from '@/components/ui/breadcrumbs'
import type { Branch, Cycle } from '@/lib/api/types'

export function cycleHref(branchId: string, cycleId: string) {
  return `/admin/branches/${branchId}/cycles/${cycleId}`
}

export function applicationFormHref(
  branchId: string,
  cycleId: string,
  roleId: string
) {
  return `${cycleHref(branchId, cycleId)}/applications/${roleId}`
}

// Branches › branch › cycle › form. The last crumb is the current page, so it
// gets no link. Missing names fall back to placeholders.
export function branchCrumbs(opts: {
  branchId?: string
  branch?: Branch
  cycleId?: string
  cycle?: Cycle
  showCycle?: boolean
  formLabel?: string
  page?: string
}): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Branches', href: '/admin/branches' }]
  if (opts.branchId) {
    crumbs.push({
      label: opts.branch?.name ?? 'Branch',
      href: `/admin/branches/${opts.branchId}`,
    })
  }
  if (opts.showCycle) {
    const cycleId = opts.cycleId ?? opts.cycle?.id
    crumbs.push({
      label: opts.cycle?.name ?? 'Cycle',
      href:
        (opts.formLabel || opts.page) && opts.branchId && cycleId
          ? cycleHref(opts.branchId, cycleId)
          : undefined,
    })
  }
  if (opts.formLabel) crumbs.push({ label: opts.formLabel })
  if (opts.page) crumbs.push({ label: opts.page })
  return crumbs
}

// Ids in a /admin/branches/... path, so the loading state can draw the
// same crumbs before the page arrives.
export function branchPathIds(pathname: string): {
  branchId?: string
  cycleId?: string
  roleId?: string
} {
  const [, branchId, cycles, cycleId, applications, roleId] =
    pathname.split('/admin/branches')[1]?.split('/') ?? []
  return {
    branchId: branchId || undefined,
    cycleId: cycles === 'cycles' ? cycleId || undefined : undefined,
    roleId: applications === 'applications' ? roleId || undefined : undefined,
  }
}
