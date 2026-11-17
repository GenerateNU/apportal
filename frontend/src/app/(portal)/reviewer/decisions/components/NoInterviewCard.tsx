'use client'

import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Copy, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { DecisionRow, DecisionTemplate } from '@/lib/api/types'
import { useMarkGenericSent } from '@/lib/queries/decisions'
import { fillTemplate } from './render'
import { useCopy } from './useCopy'
import { useBranchName } from './useBranchName'

export function NoInterviewCard({
  rows,
  template,
  cycleId,
  cycleName,
  roleName,
}: {
  rows: DecisionRow[]
  template?: DecisionTemplate
  cycleId: string
  cycleName: string
  roleName: string
}) {
  const { copy, copiedKey } = useCopy()
  const markSent = useMarkGenericSent(cycleId)
  const [showPeople, setShowPeople] = useState(false)
  const [showLetter, setShowLetter] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const unsent = rows.filter((r) => !r.sent_at)
  const branchName = useBranchName(cycleId)
  const vars = {
    applicant_name: 'there',
    branch: branchName,
    role: roleName,
    cycle: cycleName,
  }
  const subject = fillTemplate(template?.subject ?? '', vars)
  const body = fillTemplate(template?.body ?? '', vars)

  return (
    <div className="flex flex-col border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-ink text-sm font-semibold">
            {unsent.length > 0 ? `${unsent.length} to send` : 'All sent'}
            <span className="text-text-muted font-normal">
              {' '}
              · {rows.length - unsent.length} sent
            </span>
          </span>
          <span className="text-text-muted text-xs">
            Same letter for everyone. Send it once with everyone in BCC.
          </span>
        </div>
        {unsent.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                copy(
                  unsent.map((r) => r.email).join(', '),
                  'emails',
                  'email list'
                )
              }
            >
              {copiedKey === 'emails' ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
              Copy {unsent.length} emails
            </Button>
            <Button
              variant="outline"
              onClick={() => copy(`${subject}\n\n${body}`, 'letter', 'letter')}
              disabled={!template}
            >
              {copiedKey === 'letter' ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
              Copy letter
            </Button>
            <Button onClick={() => setConfirming(true)}>
              <Send size={14} />
              Mark all sent
            </Button>
          </div>
        )}
      </div>

      <Toggle open={showLetter} onClick={() => setShowLetter((v) => !v)}>
        Preview letter
      </Toggle>
      {showLetter && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 text-sm">
          <p className="text-ink mb-2 font-medium">{subject}</p>
          <p className="text-text-default whitespace-pre-wrap">{body}</p>
        </div>
      )}

      <Toggle open={showPeople} onClick={() => setShowPeople((v) => !v)}>
        {rows.length} people
      </Toggle>
      {showPeople && (
        <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto border-t border-gray-100">
          {rows.map((r) => (
            <li
              key={r.application_id}
              className="flex items-center justify-between gap-3 px-5 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="text-ink">{r.full_name}</span>
                <span className="text-text-faint"> · {r.email}</span>
              </span>
              <span
                className={
                  r.sent_at
                    ? 'text-xs text-green-700'
                    : 'text-text-subtle text-xs'
                }
              >
                {r.sent_at ? 'Sent' : 'Not sent'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Mark ${unsent.length} letters sent?`}
        description="Only do this after the email has gone out. They'll be marked rejected."
        confirmLabel="Mark sent"
        pending={markSent.isPending}
        onConfirm={() =>
          markSent.mutate(
            unsent.map((r) => r.application_id),
            { onSuccess: () => setConfirming(false) }
          )
        }
      />
    </div>
  )
}

function Toggle({
  open,
  onClick,
  children,
}: {
  open: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="text-text-muted hover:text-ink flex items-center gap-1.5 border-t border-gray-100 px-5 py-2.5 text-left text-xs"
    >
      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      {children}
    </button>
  )
}
