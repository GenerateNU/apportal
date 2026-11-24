import { LifeBuoy } from 'lucide-react'
import { cn } from '@/lib/utils'

const SOFTWARE_CHIEFS = [
  { name: 'Ally', email: 'descoteaux.a@northeastern.edu' },
  { name: 'Mai', email: 'nguyen.mai4@northeastern.edu' },
] as const

function ChiefLinks() {
  return SOFTWARE_CHIEFS.map((person, i) => (
    <span key={person.email}>
      {i > 0 && ' and '}
      <a
        href={`mailto:${person.email}`}
        title={person.email}
        className="text-text-default hover:text-ink underline underline-offset-2 transition-colors"
      >
        {person.name}
      </a>
    </span>
  ))
}

export function HelpContact({
  className,
  variant = 'line',
}: {
  className?: string
  variant?: 'line' | 'card'
}) {
  if (variant === 'card') {
    return (
      <div
        className={cn(
          'flex gap-2.5 border border-gray-200 bg-gray-50 px-3 py-2.5',
          className
        )}
      >
        <LifeBuoy size={15} className="text-text-subtle mt-0.5 shrink-0" />
        <div className="min-w-0 text-xs leading-relaxed">
          <p className="text-ink font-semibold">Need help?</p>
          <p className="text-text-subtle">
            Email our software chiefs <ChiefLinks /> if you have trouble with
            your application or this portal.
          </p>
        </div>
      </div>
    )
  }
  return (
    <p className={cn('text-text-subtle text-center text-xs', className)}>
      Having trouble with your application or this portal? Email our software
      chiefs, <ChiefLinks />
    </p>
  )
}
