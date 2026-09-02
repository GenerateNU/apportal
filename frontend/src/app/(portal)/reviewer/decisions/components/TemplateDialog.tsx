'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { DecisionKind, DecisionTemplate, Role } from '@/lib/api/types'
import { useUpdateDecisionTemplate } from '@/lib/queries/decisions'
import { ROLE_LABEL } from '@/lib/roles'
import { KIND_DESCRIPTION, KIND_LABEL } from './constants'

const KINDS: DecisionKind[] = ['rejection_post_interview', 'rejection_generic']

// Every placeholder fillTemplate knows, so a chief editing the letter can see
// what they're allowed to write rather than guessing at the syntax.
const PLACEHOLDERS = [
  ['{{applicant_name}}', 'their first name'],
  ['{{role}}', 'the role they applied for'],
  ['{{cycle}}', 'the cycle name'],
  ['{{feedback}}', 'the interviewer’s reasoning'],
  ['{{compliments}}', 'what stood out about them'],
]

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycleId: string
  role: Role
  templates: DecisionTemplate[]
}

export function TemplateDialog({
  open,
  onOpenChange,
  cycleId,
  role,
  templates,
}: TemplateDialogProps) {
  const [kind, setKind] = useState<DecisionKind>('rejection_post_interview')
  const template = templates.find((t) => t.kind === kind)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Rejection letters — {ROLE_LABEL[role]}</DialogTitle>
          <DialogDescription>
            Edited once per cycle. Every unsent message renders from these, so a
            fix here fixes all of them. The signature at the bottom is part of
            the letter — set it once.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5">
          {KINDS.map((k) => (
            <Button
              key={k}
              size="sm"
              variant={k === kind ? 'secondary' : 'ghost'}
              onClick={() => setKind(k)}
            >
              {KIND_LABEL[k]}
            </Button>
          ))}
        </div>

        {/* Remounted per kind so the form resets to the letter being edited. */}
        {template && (
          <TemplateForm
            key={template.id}
            cycleId={cycleId}
            role={role}
            template={template}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TemplateForm({
  cycleId,
  role,
  template,
  onSaved,
}: {
  cycleId: string
  role: Role
  template: DecisionTemplate
  onSaved: () => void
}) {
  const toast = useToast()
  const update = useUpdateDecisionTemplate(cycleId, role)
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body)

  function save() {
    update.mutate(
      { kind: template.kind, subject: subject.trim(), body: body.trim() },
      {
        onSuccess: () => {
          toast('Letter saved', { variant: 'success' })
          onSaved()
        },
        onError: () => toast('Could not save the letter', { variant: 'error' }),
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-text-muted text-sm">
        {KIND_DESCRIPTION[template.kind]}
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-text-default text-sm font-medium">
          Subject line
        </span>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-text-default text-sm font-medium">Body</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          className="focus:border-brand-blue text-text-default w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none"
        />
      </label>

      <div className="text-text-faint flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {PLACEHOLDERS.map(([token, meaning]) => (
          <span key={token}>
            <code className="rounded bg-gray-100 px-1 py-0.5">{token}</code>{' '}
            {meaning}
          </span>
        ))}
      </div>

      <DialogFooter>
        <Button
          onClick={save}
          disabled={update.isPending || !subject.trim() || !body.trim()}
        >
          {update.isPending ? 'Saving…' : 'Save letter'}
        </Button>
      </DialogFooter>
    </div>
  )
}
