'use client'

import { useEffect, useState } from 'react'
import type { DecisionRow } from '@/lib/api/types'
import { useUpsertDecision } from '@/lib/queries/decisions'

// Autosave delay. Long enough that writing a paragraph isn't a request per
// word, short enough that navigating away doesn't lose it.
const SAVE_DEBOUNCE_MS = 800

// The interviewer's two paragraphs, held locally and autosaved. Local rather
// than server state so the preview tracks what's being typed instead of
// lagging a save behind.
export function useFeedbackDraft(
  row: DecisionRow,
  cycleId: string,
  canWrite: boolean
) {
  const upsert = useUpsertDecision(cycleId)
  const [feedback, setFeedback] = useState(row.feedback ?? '')
  const [compliments, setCompliments] = useState(row.compliments ?? '')

  const dirty =
    feedback !== (row.feedback ?? '') || compliments !== (row.compliments ?? '')

  useEffect(() => {
    if (!dirty || !canWrite) return
    const id = setTimeout(() => {
      upsert.mutate({
        applicationId: row.application_id,
        feedback,
        compliments,
      })
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(id)
    // upsert is a new object each render; the text is what should retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, compliments, dirty, canWrite, row.application_id])

  return {
    feedback,
    setFeedback,
    compliments,
    setCompliments,
    // Shown as "Saving…" rather than a spinner — nothing blocks on it.
    saving: dirty || upsert.isPending,
  }
}
