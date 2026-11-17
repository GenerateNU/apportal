export function Subheading({
  title,
  hint,
  id,
  children,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  id?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <h2
          id={id}
          className="font-display text-ink text-base font-bold tracking-wide uppercase"
        >
          {title}
        </h2>
        {children}
      </span>
      {hint && <p className="text-text-muted text-sm">{hint}</p>}
    </div>
  )
}
