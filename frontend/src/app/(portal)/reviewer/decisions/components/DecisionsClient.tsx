'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Pencil } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  DecisionKind,
  DecisionRow,
  DecisionStatus,
  Role,
} from '@/lib/api/types'
import { defaultPipelineCycleId } from '@/lib/cycles'
import { useDecisionTemplates, useDecisions } from '@/lib/queries/decisions'
import { useCycles } from '@/lib/queries/cycles'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { KIND_LABEL, STATUS_LABEL } from './constants'
import { DecisionListRow } from './DecisionListRow'
import { TemplateDialog } from './TemplateDialog'
import { useCopy } from './useCopy'

type KindFilter = DecisionKind | 'all'
type StatusFilter = DecisionStatus | 'all'

// The chief/admin board: every applicant in the cycle awaiting a message, each
// one a finished letter to copy out and mark sent. Leads get a queue and a
// per-applicant writing screen instead — see page.tsx.
export function DecisionsClient({ currentNUID }: { currentNUID: string }) {
  const { data: cycles = [] } = useCycles({})

  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = defaultPipelineCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }

  const [role, setRole] = useState<Role>('software_engineer')
  const [kind, setKind] = useState<KindFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  // Chiefs see the whole cycle by default; the toggle is for a chief who also
  // interviewed and wants their own queue.
  const [mineOnly, setMineOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [editingTemplates, setEditingTemplates] = useState(false)
  // One row open at a time. Working through these is sequential, and marking
  // one sent opens the next — an accordion is what makes that read as progress
  // rather than a growing pile of expanded rows.
  const [openId, setOpenId] = useState<string | null>(null)

  const { data: rows = [], isLoading } = useDecisions(cycleId, {
    role,
    kind: kind === 'all' ? undefined : kind,
    interviewer_nuid: mineOnly ? currentNUID : undefined,
    search: search.trim() || undefined,
  })
  const { data: templates = [] } = useDecisionTemplates(cycleId, role)

  const cycleName = cycles.find((c) => c.id === cycleId)?.name ?? ''

  // Status is the one filter applied client-side: it's derived per row rather
  // than a column, so filtering it server-side would mean re-deriving it in
  // SQL alongside the Go that already owns the rule.
  const visible = useMemo(
    () => (status === 'all' ? rows : rows.filter((r) => r.status === status)),
    [rows, status]
  )

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === 'pending').length,
      ready: rows.filter((r) => r.status === 'ready').length,
      sent: rows.filter((r) => r.status === 'sent').length,
    }),
    [rows]
  )

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Decisions
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Every applicant getting a rejection, with their message ready to
            copy. Acceptances are written by hand and don’t appear here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setEditingTemplates(true)}
            disabled={templates.length === 0}
          >
            <Pencil size={14} />
            Edit letters
          </Button>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-40" aria-label="Filter by cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger className="w-48" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_COLUMNS.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
          <SelectTrigger className="w-44" aria-label="Filter by decision type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All decisions</SelectItem>
            <SelectItem value="rejection_post_interview">
              {KIND_LABEL.rejection_post_interview}
            </SelectItem>
            <SelectItem value="rejection_generic">
              {KIND_LABEL.rejection_generic}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as StatusFilter)}
        >
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="pending">{STATUS_LABEL.pending}</SelectItem>
            <SelectItem value="ready">{STATUS_LABEL.ready}</SelectItem>
            <SelectItem value="sent">{STATUS_LABEL.sent}</SelectItem>
          </SelectContent>
        </Select>

        <label className="text-text-secondary flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="accent-brand-blue size-4"
          />
          Only applicants I interviewed
        </label>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, NUID, or email"
          className="w-64"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-muted text-sm">
          {counts.pending} awaiting feedback · {counts.ready} ready to send ·{' '}
          {counts.sent} sent
        </p>
        <CopyAllEmails rows={visible} />
      </div>

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <p className="text-text-faint px-1 text-sm">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-text-faint px-1 text-sm">
            {mineOnly
              ? 'You have no applicants awaiting a decision message.'
              : 'No applicants match these filters.'}
          </p>
        ) : (
          visible.map((row) => (
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
              onSent={() => setOpenId(nextToSend(visible, row.application_id))}
            />
          ))
        )}
      </div>

      {cycleId && (
        <TemplateDialog
          open={editingTemplates}
          onOpenChange={setEditingTemplates}
          cycleId={cycleId}
          role={role}
          templates={templates}
        />
      )}
    </PageContainer>
  )
}

// After a message goes out, open the next one still waiting rather than
// leaving the chief on a finished row — sending thirty of these is sequential
// work, so the page should keep handing over the next one.
function nextToSend(rows: DecisionRow[], justSentId: string) {
  const from = rows.findIndex((r) => r.application_id === justSentId) + 1
  const next =
    rows.slice(from).find((r) => r.status === 'ready') ??
    rows.find((r) => r.status === 'ready' && r.application_id !== justSentId)
  return next?.application_id ?? null
}

// Every address in the current view, for one BCC pass. Only offered for the
// no-interview letters, where the message really is identical apart from the
// name — the post-interview ones each carry their own feedback and have to go
// out individually.
function CopyAllEmails({ rows }: { rows: { email: string; kind: string }[] }) {
  const { copy, copiedKey } = useCopy()
  const emails = rows
    .filter((r) => r.kind === 'rejection_generic')
    .map((r) => r.email)

  if (emails.length === 0) return null

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => copy(emails.join(', '), 'all-emails', 'address list')}
    >
      {copiedKey === 'all-emails' ? <Check size={13} /> : <Copy size={13} />}
      Copy {emails.length} no-interview{' '}
      {emails.length === 1 ? 'address' : 'addresses'}
    </Button>
  )
}
