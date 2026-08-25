'use client'

import { useEffect, useRef, useState } from 'react'

// Exported for tests: parsing is the only part of this with a failure mode
// worth covering, and vitest runs in node, where there is no localStorage.
export function parseStoredFilters<T extends object>(
  raw: string | null
): Partial<T> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}
    return parsed as Partial<T>
  } catch {
    return {}
  }
}

/**
 * Keeps a page's filter selections in localStorage under one key.
 *
 * The caller keeps its own useState as before and hands over a `snapshot` of
 * the values to store plus a `restore` that applies what came back — so this
 * writes the whole snapshot from an effect rather than making every setter a
 * write-through wrapper. Anything the caller can't validate until its own data
 * has loaded (a stored cycle id, say) gates the restore with `ready`.
 *
 * Returns whether the restore has run.
 */
export function usePersistedFilters<T extends object>(
  key: string,
  snapshot: T,
  restore: (stored: Partial<T>) => void,
  ready = true
): boolean {
  const [restored, setRestored] = useState(false)
  const restoredOnce = useRef(false)

  // Restored once on mount — done in an effect (rather than a useState
  // initializer) so the server-rendered markup and the first client render
  // match before localStorage is consulted.
  useEffect(() => {
    if (restoredOnce.current || !ready) return
    restoredOnce.current = true
    restore(parseStoredFilters<T>(localStorage.getItem(key)))
    setRestored(true)
  }, [key, ready, restore])

  // Gated on `restored` so the first render's defaults can't land on top of
  // the stored snapshot before the restore above does.
  const serialized = JSON.stringify(snapshot)
  useEffect(() => {
    if (!restored) return
    localStorage.setItem(key, serialized)
  }, [key, serialized, restored])

  return restored
}
