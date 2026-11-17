'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { closeCycle as closeCycleApi } from '@/generated/workflow/workflow'
import { queryKeys } from '@/lib/queries/keys'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'
import { STATUS_LABEL } from './constants'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DecisionRow, DecisionStatus } from '@/lib/api/types'
import { defaultPipelineCycleId } from '@/lib/cycles'
import { useDecisionTemplates, useDecisions } from '@/lib/queries/decisions'
import { useStaffAccess, useStaffCycles } from '@/lib/queries/cycle-staff'
import { DecisionListRow } from './DecisionListRow'
import { NoInterviewCard } from './NoInterviewCard'
import { useCycleRolePicker } from '@/hooks/useRoleSelection'

type Tab = 'interviewed' | 'no_interview'

const STATUS_HINT: Record<DecisionStatus, string> = {
  ready: 'Open one, copy it, send it, then mark it sent.',
  pending: "Waiting on the interviewer's paragraphs. You can write them too.",
  sent: 'Already emailed.',
}

const STATUS_EMPTY: Record<DecisionStatus, string> = {
  ready: 'Nothing ready to send',
  pending: 'Every letter has its feedback',
  sent: 'Nothing sent yet',
}

export function DecisionsClient() {
  const { data: cycles = [] } = useStaffCycles()

  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = defaultPipelineCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }

  const { role, setRole, roleIds, roleLabel } = useCycleRolePicker(cycleId)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const router = useRouter()
  const { isAdmin } = useStaffAccess()
  const toast = useToast()
  const queryClient = useQueryClient()
  const closeCycle = useMutation({
    mutationFn: () =>
      closeCycleApi(cycleId, undefined, { params: { confirm_override: true } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cycles.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.cycleStaff.all })
    },
  })

  const { data: rows = [], isLoading } = useDecisions(cycleId, {
    role_id: role || undefined,
    search: search.trim() || undefined,
  })
  const { data: templates = [] } = useDecisionTemplates(cycleId, role)

  const cycleName = cycles.find((c) => c.id === cycleId)?.name ?? ''

  const interviewed = useMemo(
    () => rows.filter((r) => r.kind === 'rejection_post_interview'),
    [rows]
  )
  const noInterview = rows.filter((r) => r.kind === 'rejection_generic')
  const countOf = (st: DecisionStatus) =>
    interviewed.filter((r) => r.status === st).length
  const [tab, setTab] = useState<Tab | null>(null)
  const [status, setStatus] = useState<DecisionStatus | null>(null)
  const activeTab: Tab =
    tab ??
    (interviewed.some((r) => r.status !== 'sent') || noInterview.length === 0
      ? 'interviewed'
      : 'no_interview')
  const activeStatus: DecisionStatus =
    (status && countOf(status) > 0 ? status : null) ??
    (countOf('ready') > 0
      ? 'ready'
      : countOf('pending') > 0
        ? 'pending'
        : 'sent')
  const shown = interviewed.filter((r) => r.status === activeStatus)
  const sent = rows.filter((r) => r.status === 'sent').length

  return (
    <PageContainer>
      <PageHeader
        title="Feedback"
        subtitle="Rejection letters, ready to copy and send."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link
                href={`/reviewer/decisions/templates${role ? `?role=${role}` : ''}`}
              >
                <Pencil size={14} />
                Letter templates
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setClosing(true)}>
              <Archive size={14} />
              Close cycle
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {roleIds.length > 1 && (
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9 w-52" aria-label="Position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleIds.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name or email"
          />
        </div>
        {rows.length > 0 && (
          <span className="text-text-muted text-sm">
            {sent} of {rows.length} sent
          </span>
        )}
      </div>

      {isLoading ? (
        <LoadingText />
      ) : rows.length === 0 ? (
        <EmptyState title="No one to write to yet" />
      ) : (
        <>
          <nav className="flex gap-6 border-b border-gray-200">
            {(
              [
                ['interviewed', 'Interviewed', interviewed.length],
                ['no_interview', 'No interview', noInterview.length],
              ] as const
            ).map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  '-mb-px flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors',
                  activeTab === id
                    ? 'border-ink text-ink'
                    : 'text-text-muted hover:text-ink border-transparent'
                )}
              >
                {label}
                <span className="text-text-subtle tabular-nums">{n}</span>
              </button>
            ))}
          </nav>

          {activeTab === 'interviewed' ? (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(['ready', 'pending', 'sent'] as const).map((st) => {
                    const n = countOf(st)
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={n === 0}
                        onClick={() => setStatus(st)}
                        className={cn(
                          'inline-flex h-8 items-center gap-1.5 border px-3 text-xs transition-colors disabled:cursor-default disabled:opacity-40',
                          activeStatus === st
                            ? 'border-ink text-ink bg-gray-50 font-medium'
                            : 'text-text-muted hover:text-ink border-gray-200 bg-white'
                        )}
                      >
                        {STATUS_LABEL[st]}
                        <span className="tabular-nums">{n}</span>
                      </button>
                    )
                  })}
                </div>
                <span className="text-text-muted text-sm">
                  {STATUS_HINT[activeStatus]}
                </span>
              </div>
              {shown.length === 0 ? (
                <EmptyState title={STATUS_EMPTY[activeStatus]} />
              ) : (
                <div className="flex flex-col divide-y divide-gray-100 border border-gray-200 bg-white">
                  {shown.map((row) => (
                    <DecisionListRow
                      key={row.application_id}
                      row={row}
                      template={templates.find((t) => t.kind === row.kind)}
                      cycleName={cycleName}
                      cycleId={cycleId}
                      open={openId === row.application_id}
                      onToggle={() =>
                        setOpenId((id) =>
                          id === row.application_id ? null : row.application_id
                        )
                      }
                      onSent={() =>
                        setOpenId(nextToSend(shown, row.application_id))
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <NoInterviewCard
              rows={noInterview}
              template={templates.find((t) => t.kind === 'rejection_generic')}
              cycleId={cycleId}
              cycleName={cycleName}
              roleName={roleLabel(role)}
            />
          )}
        </>
      )}
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={`Close ${cycleName}?`}
        description={
          rows.length > sent
            ? `${rows.length - sent} letters aren't marked sent yet. The cycle will disappear for everyone, chiefs and leads included.`
            : 'The cycle will disappear for everyone, chiefs and leads included.'
        }
        confirmLabel="Close cycle"
        pending={closeCycle.isPending}
        onConfirm={() =>
          closeCycle.mutate(undefined, {
            onSuccess: () => {
              toast(`${cycleName} closed`, { variant: 'success' })
              router.replace(isAdmin ? '/admin/branches' : '/')
            },
          })
        }
      />
    </PageContainer>
  )
}

function nextToSend(rows: DecisionRow[], justSentId: string) {
  const from = rows.findIndex((r) => r.application_id === justSentId) + 1
  const next =
    rows.slice(from).find((r) => r.status === 'ready') ??
    rows.find((r) => r.status === 'ready' && r.application_id !== justSentId)
  return next?.application_id ?? null
}
