'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCycleScope } from '@/hooks/useCycleScope'
import { cycleAudience } from '@/lib/cycle-type'
import { cn } from '@/lib/utils'

export function CycleSwitcher({ mode = 'lead' }: { mode?: 'lead' | 'chief' }) {
  const scope = useCycleScope(mode)
  if (!scope.cycle) return null

  const header = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-ink truncate text-sm font-semibold">
        {[scope.branch?.name, scope.cycle.name].filter(Boolean).join(' · ')}
      </span>
      <span className="text-text-subtle text-xs">
        Recruiting {cycleAudience(scope.cycle.application_type).toLowerCase()}
      </span>
    </span>
  )

  if (scope.cycles.length <= 1)
    return <div className="flex px-3 py-1.5">{header}</div>

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-50"
        >
          {header}
          <ChevronsUpDown size={14} className="text-ink/40 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        {scope.cycles.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => scope.setCycleId(c.id)}>
            <Check
              size={14}
              className={cn(c.id !== scope.cycleId && 'invisible')}
            />
            {c.name} · {cycleAudience(c.application_type)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
