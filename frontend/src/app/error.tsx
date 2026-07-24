'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { HelpContact } from '@/components/HelpContact'
import { Button } from '@/components/ui/button'

export default function Error({
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
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 bg-gray-50 px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-gray-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-text-default text-lg font-semibold">
          Something went wrong
        </h1>
        <p className="text-text-muted text-sm">
          We couldn&apos;t load this page. This is usually temporary — try again
          in a moment.
        </p>
        {error.digest && (
          <p className="text-text-subtle font-mono text-xs">
            Reference: {error.digest}
          </p>
        )}
        <Button onClick={() => unstable_retry()}>Try again</Button>
      </div>
      <HelpContact className="max-w-sm" />
    </div>
  )
}
