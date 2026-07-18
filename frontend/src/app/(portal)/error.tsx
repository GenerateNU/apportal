'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Scoped to the portal segment so an error while a page prefetches from the Go
// backend renders inside the portal shell (the sidebar stays) rather than
// replacing the whole app.
export default function PortalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-gray-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-text-default text-lg font-semibold">
          Couldn&apos;t load this page
        </h1>
        <p className="text-text-muted text-sm">
          The server didn&apos;t respond as expected. This is usually temporary.
        </p>
        {error.digest && (
          <p className="text-text-subtle font-mono text-xs">
            Reference: {error.digest}
          </p>
        )}
        <Button onClick={() => unstable_retry()}>Try again</Button>
      </div>
    </div>
  )
}
