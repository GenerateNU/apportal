'use client'

import type { DecisionRow } from '@/lib/api/types'

export function FeedbackFields({
  row,
  feedback,
  compliments,
  onFeedbackChange,
  onComplimentsChange,
  canWrite,
  saving,
}: {
  row: DecisionRow
  feedback: string
  compliments: string
  onFeedbackChange: (v: string) => void
  onComplimentsChange: (v: string) => void
  canWrite: boolean
  saving: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <Paragraph
        label="Why we moved forward with others"
        hint="Continues “To shed some light on this decision, …”. Two to three sentences."
        value={feedback}
        onChange={onFeedbackChange}
        disabled={!canWrite}
      />
      <Paragraph
        label="What stood out about them"
        hint="Continues “I really loved talking to you about …”. Two to three sentences."
        value={compliments}
        onChange={onComplimentsChange}
        disabled={!canWrite}
      />
      <p className="text-text-faint text-xs">
        {!canWrite
          ? `Only ${row.interviewer_name ?? 'the assigned interviewer'} or a chief can write this.`
          : saving
            ? 'Saving…'
            : 'Saved'}
      </p>
    </div>
  )
}

function Paragraph({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-text-default text-sm font-medium">{label}</span>
      <span className="text-text-faint text-xs">{hint}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={5}
        className="focus:border-brand-blue text-text-default w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none disabled:bg-gray-50 disabled:text-gray-400"
      />
    </label>
  )
}
