'use client'

export function SectionCaret({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width={10}
      height={10}
      aria-hidden
      className={`shrink-0 fill-current transition-transform ${collapsed ? '-rotate-90' : ''}`}
    >
      <path d="M1 3.25h8L5 7.75z" />
    </svg>
  )
}

export function SectionHeader({
  label,
  collapsed,
  onToggle,
  controls,
}: {
  label: React.ReactNode
  collapsed: boolean
  onToggle: () => void
  controls: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-controls={controls}
      className="font-display text-ink/45 hover:text-ink mb-1 flex w-full items-center gap-1.5 px-3 py-1 text-left text-[10px] font-bold tracking-[0.14em] uppercase transition-colors"
    >
      <span className="truncate">{label}</span>
      <SectionCaret collapsed={collapsed} />
    </button>
  )
}
