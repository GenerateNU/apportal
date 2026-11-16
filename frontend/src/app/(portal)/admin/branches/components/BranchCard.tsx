import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Branch, Cycle, Role } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { CYCLE_STATUS } from '../../cycles/lib/cycle-meta'
import {
  BRANCH_CYCLE_STATUSES,
  branchRoleNames,
  groupCyclesByStatus,
} from '../lib/branch-cycles'

// Full class names so Tailwind can see them. All pass contrast with ink text.
const BRANCH_COLORS = [
  'bg-gen-yellow',
  'bg-gen-green',
  'bg-gen-coral',
  'bg-gen-purple',
] as const

export function branchColor(index: number) {
  return BRANCH_COLORS[index % BRANCH_COLORS.length]
}

export function BranchCard({
  branch,
  cycles,
  roles,
  colorIndex,
}: {
  branch: Branch
  cycles: Cycle[]
  roles: Role[]
  colorIndex: number
}) {
  const groups = groupCyclesByStatus(cycles)
  const roleNames = branchRoleNames(cycles, roles)
  const counts = BRANCH_CYCLE_STATUSES.map(
    (status) =>
      `${groups[status].length} ${CYCLE_STATUS[status].label.toLowerCase()}`
  ).join(' · ')

  return (
    <Link
      href={`/admin/branches/${branch.id}`}
      className="group focus-visible:outline-ink relative mb-3 ml-3 block focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      {/* Offset backing panel; the card slides onto it on hover. */}
      <div
        aria-hidden
        className="border-ink absolute inset-0 -translate-x-3 translate-y-3 border-2 bg-white"
      />
      <div className="border-ink relative border-2 transition-transform duration-150 group-hover:-translate-x-1.5 group-hover:translate-y-1.5">
        <div
          className={cn(
            'flex flex-col gap-4 p-5 sm:p-7',
            branchColor(colorIndex)
          )}
        >
          <h2 className="font-display text-ink text-4xl leading-none font-bold tracking-tight break-words uppercase sm:text-6xl">
            {branch.name}
          </h2>
          {roleNames.length > 0 && (
            <ul className="flex flex-wrap gap-2.5" aria-label="Roles">
              {roleNames.map((name) => (
                <li
                  key={name}
                  className="text-ink bg-white px-3 py-1.5 text-base font-medium sm:text-lg"
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
          <p className="text-ink text-base sm:text-lg">{`Cycles: ${counts}`}</p>
        </div>
        <div className="bg-ink flex items-center gap-4 px-5 py-3 text-white sm:px-7 sm:py-4">
          <ArrowRight
            size={28}
            strokeWidth={2.5}
            aria-hidden
            className="shrink-0 transition-transform group-hover:translate-x-1"
          />
          <span className="font-display text-2xl font-bold tracking-tight uppercase sm:text-3xl">
            View cycles
          </span>
        </div>
      </div>
    </Link>
  )
}
