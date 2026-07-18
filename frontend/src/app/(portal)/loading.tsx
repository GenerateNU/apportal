export default function PortalLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        role="status"
        aria-label="Loading"
        className="border-text-faint border-t-primary size-8 animate-spin rounded-full border-4"
      />
    </div>
  )
}
