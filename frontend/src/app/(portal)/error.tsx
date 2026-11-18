'use client'

import { useEffect } from 'react'
import { ErrorScreen } from '@/components/ErrorScreen'

// Scoped to the portal segment so an error while a page prefetches from the Go
// backend renders inside the portal shell (the sidebar stays).
export default function PortalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <ErrorScreen
      code="Oops"
      title="Couldn't load this page"
      message="The server didn't respond as expected. This is usually temporary."
      digest={error.digest}
      retry={retry}
    />
  )
}
