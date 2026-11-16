'use client'

import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import type { CycleScope } from '@/hooks/useCycleScope'

export function RoleTabs({ scope }: { scope: CycleScope }) {
  if (scope.roles.roleIds.length < 2) return null
  return (
    <SegmentedTabs
      tabs={scope.roles.roleIds.map((id) => ({
        id,
        label: scope.roles.roleLabel(id),
      }))}
      value={scope.roleId}
      onChange={scope.setRoleId}
    />
  )
}
