'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { HelpContact } from '@/components/HelpContact'
import { ErrorState } from '@/components/ui/error-state'

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
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-white px-4">
      <ErrorState
        title="Something went wrong"
        description="The server didn't respond as expected. This is usually temporary."
        reference={error.digest}
        onRetry={() => unstable_retry()}
      />
      <HelpContact className="max-w-md" />
    </div>
  )
}
