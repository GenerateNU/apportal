'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { HelpContact } from '@/components/HelpContact'
import { ErrorState } from '@/components/ui/error-state'

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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <ErrorState
        title="Couldn't load this page"
        description="The server didn't respond as expected. This is usually temporary."
        reference={error.digest}
        onRetry={() => unstable_retry()}
      />
      <HelpContact className="max-w-md" />
    </div>
  )
}
