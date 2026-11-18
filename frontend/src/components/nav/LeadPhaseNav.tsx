'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Check, Lock, Users } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { useCycleScope } from '@/hooks/useCycleScope'
import {
  currentPhase,
  type MyWorkPhase,
  useMyWork,
} from '@/lib/queries/my-work'
import { cn } from '@/lib/utils'
import { isNavItemActive } from './NavItem'
import { CycleSwitcher } from './CycleSwitcher'

const MY_WORK = '/reviewer/my-work'

const ALSO: Record<MyWorkPhase['id'], string[]> = {
  reviews: ['/reviewer/my-reviews'],
  interviews: ['/reviewer/my-interviews', '/reviewer/interview-script'],
  interviewReviews: [],
  preference: ['/reviewer/preference-lists'],
  draft: ['/reviewer/my-work/draft', '/reviewer/draft'],
  feedback: ['/reviewer/decisions'],
}

export function LeadPhaseNav({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const requested = useSearchParams().get('phase')
  const { cycleId } = useCycleScope('lead')
  const { data: phases = [] } = useMyWork(cycleId)
  const current = currentPhase(phases)

  function isActive(phase: MyWorkPhase) {
    if (pathname === MY_WORK) {
      return requested ? requested === phase.id : current?.id === phase.id
    }
    return ALSO[phase.id].some((h) => isNavItemActive(pathname, h))
  }

  const applicantsActive = isNavItemActive(pathname, '/reviewer/applications')

  // e.g. an admin when no chief cycle exists yet.
  if (!cycleId) return null
  // Open at every phase: applicants can be browsed before reviews start.
  const applicantsHref = `/reviewer/applications?cycle=${cycleId}`

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Tooltip label="Applicants">
          <Link
            href={applicantsHref}
            aria-label="Applicants"
            className={cn(
              'flex size-9 items-center justify-center',
              applicantsActive
                ? 'bg-ink text-white'
                : 'text-ink/60 hover:bg-gray-100'
            )}
          >
            <Users size={18} />
          </Link>
        </Tooltip>
        {phases.map((p, i) => {
          const locked = p.status === 'locked'
          return (
            <Tooltip
              key={p.id}
              label={locked ? (p.locked_reason ?? p.label) : p.label}
            >
              <Link
                href={locked ? '#' : `${MY_WORK}?phase=${p.id}`}
                aria-disabled={locked}
                className={cn(
                  'flex size-9 items-center justify-center text-xs font-bold',
                  isActive(p)
                    ? 'bg-ink text-white'
                    : locked
                      ? 'text-ink/25 pointer-events-none'
                      : 'text-ink/60 hover:bg-gray-100'
                )}
              >
                {p.status === 'done' ? <Check size={14} /> : i + 1}
              </Link>
            </Tooltip>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <CycleSwitcher mode="lead" />
      <div className="mt-2 flex flex-col">
        <ol className="flex flex-col">
          <li>
            <Link href={applicantsHref} className="block">
              <span
                className={cn(
                  'relative flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
                  applicantsActive
                    ? 'text-ink before:bg-ink bg-gray-100 font-semibold before:absolute before:inset-y-1 before:left-0 before:w-[3px]'
                    : 'text-ink/70 hover:text-ink font-medium hover:bg-gray-50'
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  <Users size={14} className="text-ink/60" />
                </span>
                <span className="flex-1 truncate">Applicants</span>
              </span>
            </Link>
          </li>
          {phases.map((p, i) => {
            const active = isActive(p)
            const locked = p.status === 'locked'
            const done = p.status === 'done'
            const isCurrent = p.id === current?.id && !done
            const row = (
              <span
                className={cn(
                  'relative flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'text-ink before:bg-ink bg-gray-100 font-semibold before:absolute before:inset-y-1 before:left-0 before:w-[3px]'
                    : locked
                      ? 'text-ink/35 font-medium'
                      : 'text-ink/70 hover:text-ink font-medium hover:bg-gray-50'
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    done && 'bg-ink/10 text-ink',
                    isCurrent && 'bg-ink text-white',
                    locked && 'text-ink/40 border border-gray-200',
                    !locked && !done && !isCurrent && 'border border-gray-300'
                  )}
                >
                  {done ? (
                    <Check size={11} strokeWidth={3} />
                  ) : locked ? (
                    <Lock size={9} strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="flex-1 truncate">{p.label}</span>
                {!locked && !done && p.total > 0 && (
                  <span className="text-text-subtle text-xs tabular-nums">
                    {p.done}/{p.total}
                  </span>
                )}
              </span>
            )
            return (
              <li key={p.id}>
                {locked ? (
                  <Tooltip label={p.locked_reason ?? ''}>
                    <span className="block cursor-not-allowed">{row}</span>
                  </Tooltip>
                ) : (
                  <Link href={`${MY_WORK}?phase=${p.id}`} className="block">
                    {row}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
