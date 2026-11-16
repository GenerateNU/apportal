'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/toast'

// Copy-to-clipboard with a short "Copied" acknowledgement on the button
// itself. This page's whole job is copying, so the feedback lives on the
// control rather than only in a toast the user has to look away for.
export function useCopy(resetMs = 1500) {
  const toast = useToast()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const copy = useCallback(
    async (text: string, key: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedKey(key)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopiedKey(null), resetMs)
      } catch {
        // Clipboard access needs a secure context and can be blocked outright,
        // and a copy that silently does nothing is worse than saying so.
        toast(`Could not copy the ${label} — select it instead`, {
          variant: 'error',
        })
      }
    },
    [resetMs, toast]
  )

  return { copy, copiedKey }
}
