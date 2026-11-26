'use client'

import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function useStoredFlag(
  key: string,
  fallback: boolean
): [boolean, (value: boolean) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  )
  const value = stored === null ? fallback : stored === '1'
  function set(next: boolean) {
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {}
    listeners.forEach((l) => l())
  }
  return [value, set]
}
