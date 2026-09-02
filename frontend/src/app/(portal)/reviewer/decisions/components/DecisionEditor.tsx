'use client'

import { useState } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DecisionRow, DecisionTemplate } from '@/lib/api/types'
import { useUpsertDecision } from '@/lib/queries/decisions'
import { isDecided } from './constants'
import { FeedbackFields } from './FeedbackFields'
import { MessagePreview } from './MessagePreview'
import { renderDecision } from './render'
import { useFeedbackDraft } from './useFeedbackDraft'

// The chief's board only. A chief reads the finished message, not the review
// history behind it — the lead's feedback is already in the letter, so the
// applicant's reviews would be noise here. The lead's own screen
// (decisions/[id]) is where that history is shown.
interface DecisionEditorProps {
  row: DecisionRow
  template?: DecisionTemplate
  cycleName: string
  cycleId: string
  // Called after the message is marked sent, so the board can move the chief
  // on to the next one rather than leaving them on a finished row.
  onSent?: () => void
}

export function DecisionEditor({
  row,
  template,
  cycleName,
  cycleId,
  onSent,
}: DecisionEditorProps) {
  const needsFeedback = row.kind === 'rejection_post_interview'
  // Chiefs may always write, so a lead who never filled theirs in doesn't
  // block the send.
  const draft = useFeedbackDraft(row, cycleId, true)

  const rendered = renderDecision(
    { ...row, feedback: draft.feedback, compliments: draft.compliments },
    template,
    cycleName
  )

  return (
    <div className="border-t border-gray-200 bg-gray-50/60 p-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {needsFeedback ? (
            <FeedbackFields
              row={row}
              feedback={draft.feedback}
              compliments={draft.compliments}
              onFeedbackChange={draft.setFeedback}
              onComplimentsChange={draft.setCompliments}
              canWrite
              saving={draft.saving}
            />
          ) : (
            <p className="text-text-muted text-sm">
              This applicant did not interview, so their letter has no feedback
              paragraph — it’s ready to send as written.
            </p>
          )}

          <ChiefControls
            row={row}
            cycleId={cycleId}
            renderedBody={rendered.body}
            onSent={onSent}
          />
        </div>

        <MessagePreview
          rendered={rendered}
          email={row.email}
          copyKeyPrefix={row.application_id}
          overridden={!!row.body_override}
        />
      </div>
    </div>
  )
}

// Hand-editing and marking sent, both chief-only at the API too.
function ChiefControls({
  row,
  cycleId,
  renderedBody,
  onSent,
}: {
  row: DecisionRow
  cycleId: string
  renderedBody: string
  onSent?: () => void
}) {
  const upsert = useUpsertDecision(cycleId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.body_override ?? renderedBody)

  const sent = !!row.sent_at

  if (editing) {
    return (
      <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          className="focus:border-brand-blue text-text-default w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              upsert.mutate({
                applicationId: row.application_id,
                body_override: draft,
              })
              setEditing(false)
            }}
          >
            Save this message
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setDraft(row.body_override ?? renderedBody)
            setEditing(true)
          }}
        >
          Edit this message
        </Button>
        {row.body_override && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              upsert.mutate({
                applicationId: row.application_id,
                body_override: '',
              })
            }
          >
            <Undo2 size={13} />
            Revert to template
          </Button>
        )}
        <Button
          size="sm"
          variant={sent ? 'ghost' : 'default'}
          disabled={upsert.isPending}
          onClick={() =>
            upsert.mutate(
              { applicationId: row.application_id, mark_sent: !sent },
              { onSuccess: () => !sent && onSent?.() }
            )
          }
        >
          {sent ? 'Undo — not sent' : 'Mark sent & reject'}
        </Button>
      </div>
      <p className="text-text-faint text-xs">
        {sent
          ? `Sent, and ${row.full_name} is marked rejected. Undoing puts them back where they were.`
          : `Records the email as sent and moves ${row.full_name} to the rejected stage${isDecided(row.stage) ? '' : ' — they’re still in the pipeline right now'}.`}
      </p>
    </div>
  )
}
