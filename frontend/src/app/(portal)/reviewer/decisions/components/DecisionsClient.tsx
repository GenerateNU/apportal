'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Pencil } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
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
import { useStaffCycles } from '@/lib/queries/cycle-staff'
import { DecisionListRow } from './DecisionListRow'
import { TemplateDialog } from './TemplateDialog'
import { useCopy } from './useCopy'
import { useCycleRolePicker } from '@/hooks/useRoleSelection'

type StatusFilter = DecisionStatus | 'all'

export function DecisionsClient() {
  const { data: cycles = [] } = useStaffCycles()

  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = defaultPipelineCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }

  const { role, setRole, roleIds, roleLabel } = useCycleRolePicker(cycleId)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [editingTemplates, setEditingTemplates] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const { data: rows = [], isLoading } = useDecisions(cycleId, {
    role_id: role || undefined,
    search: search.trim() || undefined,
  })
  const { data: templates = [] } = useDecisionTemplates(cycleId, role)

  const cycleName = cycles.find((c) => c.id === cycleId)?.name ?? ''

  const visible = useMemo(
    () => (status === 'all' ? rows : rows.filter((r) => r.status === status)),
    [rows, status]
  )

  const count = (s: DecisionStatus) => rows.filter((r) => r.status === s).length

  return (
    <PageContainer>
      <PageHeader
        title="Decisions"
        subtitle="Rejection letters, ready to copy and send."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setEditingTemplates(true)}
              disabled={templates.length === 0}
            >
              <Pencil size={14} />
              Edit letters
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedTabs<StatusFilter>
            className="h-9 w-fit"
            tabs={[
              { id: 'all', label: 'All', count: rows.length },
              {
                id: 'pending',
                label: 'Needs feedback',
                count: count('pending'),
              },
              { id: 'ready', label: 'Ready', count: count('ready') },
              { id: 'sent', label: 'Sent', count: count('sent') },
            ]}
            value={status}
            onChange={setStatus}
          />
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
        <CopyAllEmails rows={visible} />
      </div>

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <LoadingText className="px-1" />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              rows.length === 0 ? 'No one to write to yet' : 'Nothing here'
            }
          />
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

function nextToSend(rows: DecisionRow[], justSentId: string) {
  const from = rows.findIndex((r) => r.application_id === justSentId) + 1
  const next =
    rows.slice(from).find((r) => r.status === 'ready') ??
    rows.find((r) => r.status === 'ready' && r.application_id !== justSentId)
  return next?.application_id ?? null
}

// Only the no-interview letters are identical, so only they can go out as one BCC.
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
      {emails.length === 1 ? 'email' : 'emails'}
    </Button>
  )
}
