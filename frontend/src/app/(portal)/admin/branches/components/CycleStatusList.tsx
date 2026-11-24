import { SectionLabel } from '@/components/ui/section-label'
import { Subheading } from '@/components/ui/subheading'
import type { Cycle, Role } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { CYCLE_STATUS } from '../../cycles/lib/cycle-meta'
import type { BranchCycleStatus } from '../lib/branch-cycles'
import { CycleCard } from './CycleCard'
import { Count } from '@/components/ui/badge'

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
  // Open and draft are the cycles someone is working on; closed ones are history.
  const open = status !== 'closed'
  const title = (
    <span className="inline-flex items-center gap-2">
      {label} cycles <Count value={cycles.length} />
    </span>
  )

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col',
        open ? 'gap-4' : 'gap-3 border-t border-gray-200 pt-5'
      )}
    >
      {open ? (
        <Subheading
          id={headingId}
          title={title}
          hint={
            status === 'open'
              ? 'Cycles taking applications or running reviews right now.'
              : 'Cycles still being set up.'
          }
        />
      ) : (
        <SectionLabel>
          <span id={headingId}>{title}</span>
        </SectionLabel>
      )}
      {cycles.length === 0 ? (
        <p className="text-text-muted text-sm">
          {`No ${label.toLowerCase()} cycles in this branch.`}
        </p>
      ) : (
        <ul
          className={cn(
            'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3',
            !open && 'opacity-80'
          )}
        >
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
