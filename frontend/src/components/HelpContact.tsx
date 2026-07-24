import { cn } from '@/lib/utils'

const SOFTWARE_CHIEFS = [
  { name: 'Ally', email: 'descoteaux.a@northeastern.edu' },
  { name: 'Dao', email: 'ho.dao@northeastern.edu' },
] as const

export function HelpContact({ className }: { className?: string }) {
  return (
    <p className={cn('text-text-subtle text-center text-xs', className)}>
      If you run into any issues at all with your application or this portal,
      please reach out to the software chiefs{' '}
      {SOFTWARE_CHIEFS.map((person, i) => (
        <span key={person.email}>
          {i > 0 && ' and '}
          <a
            href={`mailto:${person.email}`}
            className="text-text-default hover:text-brand-blue underline underline-offset-2 transition-colors"
          >
            {person.name} ({person.email})
          </a>
        </span>
      ))}
      .
    </p>
  )
}
