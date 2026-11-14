import { useEffect, useState } from 'react'

export function normalizeUrl(value: string): string {
  const v = value.trim()
  if (!v || /^[a-z][a-z0-9+.-]*:/i.test(v)) return v
  return v.includes('.') ? `https://${v}` : v
}

export function urlError(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  let url: URL
  try {
    url = new URL(v)
  } catch {
    return 'Enter a full link, like https://github.com/you'
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'Links must start with http:// or https://'
  }
  if (!/\.[a-z]{2,}$/i.test(url.hostname)) {
    return 'That link is missing a domain, like github.com'
  }
  return null
}

export function useSettledValue(value: string, delayMs = 800) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}
