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

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        {phases.map((p, i) => {
          const locked = p.status === 'locked'
          return (
            <Tooltip
              side="right"
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
        <Tooltip side="right" label="Applicants">
          <Link
            href="/reviewer/applications"
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
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <CycleSwitcher mode="lead" />
      <div className="mt-2 flex flex-col">
        <ol className="flex flex-col">
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
                  <Tooltip side="right" label={p.locked_reason ?? ''}>
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
        <Link
          href="/reviewer/applications"
          className={cn(
            'relative mt-2 flex items-center gap-2.5 border-t border-gray-100 px-3 pt-3 pb-1.5 text-sm transition-colors',
            applicantsActive
              ? 'text-ink font-semibold'
              : 'text-ink/70 hover:text-ink font-medium'
          )}
        >
          <Users size={16} className="text-ink/50 shrink-0" />
          Browse applicants
        </Link>
      </div>
    </div>
  )
}
