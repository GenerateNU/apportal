import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative w-full sm:w-64', className)}>
      <Search className="text-text-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="placeholder:text-text-subtle focus-visible:border-ink focus-visible:ring-ink/20 h-9 w-full border border-gray-300 bg-white py-1.5 pr-3 pl-9 text-sm outline-none focus-visible:ring-3"
      />
    </div>
  )
}
