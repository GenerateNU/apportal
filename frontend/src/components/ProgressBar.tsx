export function ProgressBar({
  value,
  total,
  className = '',
}: {
  value: number
  total: number
  className?: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-gray-100 ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div
        className="h-full rounded-full bg-green-600 transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
