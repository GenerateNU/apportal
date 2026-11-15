import { SectionLabel } from '@/components/ui/section-label'
import type { Cycle, Role } from '@/lib/api/types'
import { CYCLE_STATUS } from '../../cycles/lib/cycle-meta'
import type { BranchCycleStatus } from '../lib/branch-cycles'
import { CycleCard } from './CycleCard'

export function CycleStatusList({
  status,
  cycles,
  roles,
}: {
  status: BranchCycleStatus
  cycles: Cycle[]
  roles: Role[]
}) {
  const { label } = CYCLE_STATUS[status]
  const headingId = `cycles-${status}`

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 border border-dashed border-gray-300 p-4 sm:p-5"
    >
      <SectionLabel>
        <span id={headingId}>{`${label} cycles · ${cycles.length}`}</span>
      </SectionLabel>
      {cycles.length === 0 ? (
        <p className="text-text-muted py-4 text-center text-sm">
          {`No ${label.toLowerCase()} cycles in this branch.`}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cycles.map((cycle) => (
            <li key={cycle.id}>
              <CycleCard
                cycle={cycle}
                roles={roles.filter((r) => r.cycle_id === cycle.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
