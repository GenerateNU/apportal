'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Lock } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { useCycleScope } from '@/hooks/useCycleScope'
import { useWorkflow } from '@/lib/queries/workflow'
import { cn } from '@/lib/utils'
import { type Phase, stepActive, toPhases } from './chief-stages'
import { CycleSwitcher } from './CycleSwitcher'

export function useChiefPhases() {
  const scope = useCycleScope('chief')
  const { data: workflow } = useWorkflow(scope.cycleId)
  const phases = useMemo(() => toPhases(workflow), [workflow])
  return { scope, phases }
}

function furthestOpenStep(phases: Phase[]) {
  for (const p of [...phases].reverse()) {
    if (p.status === 'locked') continue
    const step = p.steps.find((s) => !s.locked)
    if (step) return step
  }
}

export function ChiefCycleNav({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const { scope, phases } = useChiefPhases()
  const onPage = phases.findIndex((p) =>
    p.steps.some((s) => stepActive(pathname, search, s))
  )
  const lockedHere =
    onPage >= 0 &&
    (phases[onPage].status === 'locked' ||
      phases[onPage].steps.some(
        (s) => s.locked && stepActive(pathname, search, s)
      ))
  const fallback = lockedHere ? furthestOpenStep(phases)?.href : undefined
  const [opened, setOpened] = useState<string | null>(null)
  const [prevPathname, setPrevPathname] = useState(pathname)
  const [prevCycle, setPrevCycle] = useState(scope.cycleId)
  if (pathname !== prevPathname || scope.cycleId !== prevCycle) {
    setPrevPathname(pathname)
    setPrevCycle(scope.cycleId)
    setOpened(null)
  }

  useEffect(() => {
    if (!fallback || !scope.cycleId) return
    router.replace(
      `${fallback}?${new URLSearchParams({ cycle: scope.cycleId })}`
    )
  }, [fallback, scope.cycleId, router])

  if (phases.length === 0) return null

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        {phases.map((p, i) => (
          <Tooltip key={p.key} label={p.label}>
            <Link
              href={p.status === 'locked' ? '#' : (p.steps[0]?.href ?? '#')}
              aria-disabled={p.status === 'locked'}
              className={cn(
                'flex size-9 items-center justify-center text-xs font-bold',
                i === onPage
                  ? 'bg-ink text-white'
                  : p.status === 'current'
                    ? 'text-ink border-ink border'
                    : p.status === 'locked'
                      ? 'text-ink/25 pointer-events-none'
                      : 'text-ink/50 hover:bg-gray-100'
              )}
            >
              {p.status === 'done' ? <Check size={14} /> : i + 1}
            </Link>
          </Tooltip>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <CycleSwitcher mode="chief" />
      <ol className="mt-2 flex flex-col">
        {phases.map((p, i) => {
          const expanded = opened ? opened === p.key : i === onPage
          return (
            <PhaseRow
              key={p.key}
              phase={p}
              index={i}
              expanded={expanded}
              pathname={pathname}
              search={search}
              onToggle={() => setOpened(expanded ? '__none' : p.key)}
            />
          )
        })}
      </ol>
    </div>
  )
}

function PhaseRow({
  phase,
  index,
  expanded,
  pathname,
  search,
  onToggle,
}: {
  phase: Phase
  index: number
  expanded: boolean
  pathname: string
  search: string
  onToggle: () => void
}) {
  const locked = phase.status === 'locked'
  const only = phase.steps.length === 1 ? phase.steps[0] : undefined
  if (only && !locked && !only.locked) {
    const active = stepActive(pathname, search, only)
    return (
      <li>
        <Link
          href={only.href}
          className={cn(
            'flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
            active
              ? 'text-ink bg-gray-100 font-semibold'
              : 'text-ink/70 font-medium hover:bg-gray-50'
          )}
        >
          <StageDot phase={phase} index={index} />
          <span className="flex-1 truncate">{phase.label}</span>
        </Link>
      </li>
    )
  }
  const header = (
    <button
      type="button"
      onClick={locked ? undefined : onToggle}
      aria-expanded={locked ? undefined : expanded}
      aria-disabled={locked || undefined}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors',
        locked ? 'cursor-default' : 'hover:bg-gray-50',
        expanded ? 'text-ink font-semibold' : 'font-medium',
        locked ? 'text-ink/40' : !expanded && 'text-ink/70'
      )}
    >
      <StageDot phase={phase} index={index} />
      <span className="flex-1 truncate">{phase.label}</span>
    </button>
  )

  return (
    <li className="flex flex-col">
      {locked && phase.lockedReason ? (
        <Tooltip label={phase.lockedReason}>{header}</Tooltip>
      ) : (
        header
      )}
      {expanded && !locked && phase.steps.length === 0 && (
        <p className="text-text-subtle mb-1 ml-[1.375rem] border-l border-gray-200 py-1.5 pl-4 text-xs">
          Chiefs are running this stage.
        </p>
      )}
      {expanded && !locked && phase.steps.length > 0 && (
        <ul className="mb-1 ml-[1.375rem] flex flex-col border-l border-gray-200">
          {phase.steps.map((step) => {
            const active = stepActive(pathname, search, step)
            const disabled = locked || !!step.locked
            const label = (
              <span
                className={cn(
                  'relative flex items-center gap-1.5 py-1.5 pr-3 pl-4 text-sm transition-colors',
                  active
                    ? 'text-ink before:bg-ink bg-gray-100 font-semibold before:absolute before:inset-y-1 before:-left-px before:w-[2px]'
                    : disabled
                      ? 'text-ink/35'
                      : 'text-ink/70 hover:text-ink hover:bg-gray-50'
                )}
              >
                {step.locked && <Lock size={11} />}
                {step.label}
              </span>
            )
            return (
              <li key={step.href}>
                {disabled ? (
                  <Tooltip label={step.locked ?? phase.lockedReason ?? ''}>
                    <span className="block cursor-not-allowed">{label}</span>
                  </Tooltip>
                ) : (
                  <Link href={step.href} className="block">
                    {label}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

function StageDot({ phase, index }: { phase: Phase; index: number }) {
  const locked = phase.status === 'locked'
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
        phase.status === 'done' && 'bg-ink/10 text-ink',
        phase.status === 'current' && 'bg-ink text-white',
        locked && 'text-ink/40 border border-gray-200'
      )}
    >
      {phase.status === 'done' ? (
        <Check size={11} strokeWidth={3} />
      ) : locked ? (
        <Lock size={9} strokeWidth={3} />
      ) : (
        index + 1
      )}
    </span>
  )
}
