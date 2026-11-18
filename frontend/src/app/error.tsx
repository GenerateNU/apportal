'use client'

import { useEffect } from 'react'
import { ErrorScreen } from '@/components/ErrorScreen'

export default function Error({
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
      fullPage
      code="Oops"
      title="Something went wrong"
      message="We couldn't load this page. This is usually temporary, so try again in a moment."
      digest={error.digest}
      retry={retry}
    />
  )
}
