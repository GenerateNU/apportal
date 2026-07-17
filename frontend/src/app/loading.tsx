export default function Loading() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gray-50">
      <div
        role="status"
        aria-label="Loading"
        className="border-text-faint border-t-primary size-8 animate-spin rounded-full border-4"
      />
    </div>
  )
}
