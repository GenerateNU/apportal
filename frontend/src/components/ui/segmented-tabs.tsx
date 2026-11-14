import { cn } from '@/lib/utils'

export type SegmentedTab<T extends string> = {
  id: T
  label: React.ReactNode
  count?: number
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: SegmentedTab<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex shrink-0 border border-gray-300 bg-white',
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'font-display flex items-center gap-1.5 px-3.5 py-1.5 text-xs tracking-wider whitespace-nowrap uppercase transition-colors not-last:border-r not-last:border-gray-300',
              active ? 'bg-ink text-white' : 'text-ink hover:bg-gray-100'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={active ? 'text-white/70' : 'text-ink/50'}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
