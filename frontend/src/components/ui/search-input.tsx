import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  size = 'default',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  size?: 'default' | 'sm'
  className?: string
}) {
  const sm = size === 'sm'
  return (
    <div className={cn('relative w-full sm:w-64', className)}>
      <Search
        className={cn(
          'text-text-subtle pointer-events-none absolute top-1/2 -translate-y-1/2',
          sm ? 'left-2.5 h-3.5 w-3.5' : 'left-3 h-4 w-4'
        )}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'placeholder:text-text-subtle focus-visible:border-ink focus-visible:ring-ink/20 w-full border bg-white outline-none focus-visible:ring-3',
          sm
            ? 'h-8 border-gray-200 pr-2.5 pl-8 text-xs'
            : 'h-9 border-gray-300 py-1.5 pr-3 pl-9 text-sm'
        )}
      />
    </div>
  )
}
