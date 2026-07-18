'use client' // Error boundaries must be Client Components

// global-error replaces the root layout when the root layout or template itself
// throws, so it must render its own <html> and <body>.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-gray-50 px-4 font-sans antialiased">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-gray-100 bg-white p-8 text-center shadow-sm">
          <title>Something went wrong</title>
          <h1 className="text-lg font-semibold text-[#111111]">
            Something went wrong
          </h1>
          <p className="text-sm text-[#6b7280]">
            The application ran into an unexpected error. Please try again.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-[#9ca3af]">
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={() => unstable_retry()}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[#1477f8] px-3 text-sm font-medium text-white transition-colors hover:bg-[#1477f8]/80"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
