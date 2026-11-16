export function LiveDot({ label }: { label: string }) {
  return (
    <span className="relative flex size-2 shrink-0">
      <span className="bg-status-open absolute inline-flex size-full animate-ping rounded-full opacity-60" />
      <span className="bg-status-open relative inline-flex size-2 rounded-full" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
