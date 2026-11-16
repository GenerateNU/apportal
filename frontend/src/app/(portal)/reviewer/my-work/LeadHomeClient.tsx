'use client'

import { redirect, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { TABLE_FRAME, TABLE_ROW } from '@/components/ui/table-styles'
import { cn, formatDate } from '@/lib/utils'
import { DueLine } from '@/components/ui/due-line'
import { useMyPipeline } from '@/lib/queries/my-work'
import { PAGE_TOP, PAGE_X } from '@/components/ui/page-shell'

import { LeadPreferenceListClient } from '../preference-lists/[id]/components/LeadPreferenceListClient'
import { LeadDraftClient } from './draft/LeadDraftClient'
import { type Phase, type Task, useLeadWork } from './useLeadWork'

function PhaseProgress({ phase }: { phase: Phase }) {
  const { total, doneCount } = phase
  if (!phase.open || total === 0) return null
  return (
    <div className="flex items-end gap-6">
      {phase.deadline && (
        <div className="flex flex-col gap-1">
          <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
            Due
          </span>
          <span className="text-ink text-sm font-semibold">
            {formatDate(phase.deadline)}
          </span>
        </div>
      )}
      <div className="flex w-44 flex-col gap-1.5">
        <span className="flex items-baseline justify-between">
          <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
            {phase.done ? 'All done' : 'Done'}
          </span>
          <span className="text-ink text-sm font-semibold tabular-nums">
            {doneCount}
            <span className="text-text-subtle font-normal"> / {total}</span>
          </span>
        </span>
        <span className="block h-1.5 w-full bg-gray-200">
          <span
            className="bg-ink block h-full transition-[width]"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </span>
      </div>
    </div>
  )
}

export function LeadHomeClient() {
  const {
    cycle,
    phases,
    current,
    summary,
    roleIds,
    roleLabel,
    loading: loadingWork,
  } = useLeadWork()
  const requestedPhase = useSearchParams().get('phase')
  const { data: mine } = useMyPipeline(cycle?.id ?? '')
  const reviewDue = (roleId: string) =>
    mine?.tasks?.find((t) => t.kind === 'review' && t.role_id === roleId)
      ?.due_at
  const selected =
    phases.find((p) => p.id === requestedPhase && p.open) ??
    current ??
    phases[0]

  if (loadingWork) return <LeadHomeSkeleton />

  if (!cycle) redirect('/applicant/applications')

  if (selected?.open && selected.id === 'draft') return <LeadDraftClient />
  const myListId = selected?.id === 'preference' ? selected.tasks[0]?.id : ''
  if (selected?.open && myListId) {
    return <LeadPreferenceListClient id={myListId} embedded />
  }

  return (
    <LeadPage>
      <PageHeader
        title={selected?.label ?? 'My work'}
        subtitle={selected?.blurb ?? summary}
        actions={selected && <PhaseProgress phase={selected} />}
      />

      {selected && !selected.open && (
        <p className="text-text-muted flex items-center gap-1.5 text-sm">
          <Lock size={13} /> {selected.locked}
        </p>
      )}
      {selected && renderPhasePanel(selected)}
    </LeadPage>
  )

  function renderPhasePanel(phase: Phase) {
    if (!phase.open) {
      return <EmptyState title="Not open yet" description={phase.locked} />
    }
    const groups = new Map<string, Task[]>()
    for (const task of phase.tasks) {
      const key = phase.grouped ? (task.roleId ?? '') : ''
      groups.set(key, [...(groups.get(key) ?? []), task])
    }
    const rank = (id: string) => {
      const i = roleIds.indexOf(id)
      return i === -1 ? roleIds.length : i
    }
    const sections = phase.sections
      ? phase.sections.map((sec) => ({
          key: sec.title,
          title: sec.title as string | null,
          aside: sec.aside,
          due: undefined as Date | undefined,
          tasks: sec.tasks,
        }))
      : [...groups.entries()]
          .sort(([a], [b]) => rank(a) - rank(b))
          .map(([roleId, tasks]) => ({
            key: roleId,
            title: phase.grouped
              ? roleId
                ? roleLabel(roleId)
                : 'Other'
              : null,
            aside: `${tasks.filter((t) => t.done).length} of ${tasks.length} done`,
            due:
              phase.id === 'reviews' && reviewDue(roleId)
                ? new Date(reviewDue(roleId)!)
                : undefined,
            tasks,
          }))
    return (
      <div className="flex flex-col gap-10">
        {sections.map(({ key, title, aside, due, tasks }) => {
          const ordered = [...tasks].sort(
            (a, b) => Number(a.done) - Number(b.done)
          )
          return (
            <section key={key} className="flex flex-col gap-4">
              {title && (
                <div className="flex items-end justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="font-display text-ink text-xl font-bold tracking-tight uppercase">
                      {title}
                    </h2>
                    {due && <DueLine date={due} label="Reviews due" />}
                  </div>
                  {aside && (
                    <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
                      {aside}
                    </span>
                  )}
                </div>
              )}
              <div className={TABLE_FRAME}>
                {ordered.map((task) => (
                  <Link
                    key={task.id}
                    href={task.href}
                    className={cn(
                      'group flex flex-wrap items-center gap-x-6 gap-y-2',
                      TABLE_ROW,
                      task.waiting && 'opacity-60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-ink block truncate font-semibold">
                        {task.title}
                      </span>
                      {task.meta && (
                        <p className="text-text-muted mt-0.5 text-xs">
                          {task.meta}
                        </p>
                      )}
                    </div>
                    <Badge className={task.status.className}>
                      {task.status.label}
                    </Badge>
                    <span className="text-text-subtle group-hover:text-ink flex w-20 items-center justify-end gap-1 text-sm font-medium transition-colors">
                      {task.action}
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    )
  }
}

function LeadHomeSkeleton() {
  return (
    <LeadPage>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="h-8 w-28 animate-pulse bg-gray-100" />
        ))}
      </div>
      <div className="h-24 animate-pulse border border-gray-100 bg-gray-50" />
      <div className={TABLE_FRAME}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={cn('flex items-center gap-6', TABLE_ROW)}>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="h-4 w-40 animate-pulse bg-gray-100" />
              <span className="h-3 w-24 animate-pulse bg-gray-100" />
            </div>
            <span className="h-5 w-20 animate-pulse bg-gray-100" />
            <span className="h-4 w-16 animate-pulse bg-gray-100" />
          </div>
        ))}
      </div>
    </LeadPage>
  )
}

function LeadPage({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('flex w-full flex-col gap-8 pb-12', PAGE_X, PAGE_TOP)}>
      {children}
    </div>
  )
}
