import { cn } from '@/lib/utils'

const SOFTWARE_CHIEFS = [
  { name: 'Ally', email: 'descoteaux.a@northeastern.edu' },
  { name: 'Dao', email: 'ho.dao@northeastern.edu' },
] as const

export function HelpContact({ className }: { className?: string }) {
  return (
    <p className={cn('text-text-subtle text-center text-xs', className)}>
      Trouble with your application or this portal? Email the software chiefs{' '}
      {SOFTWARE_CHIEFS.map((person, i) => (
        <span key={person.email}>
          {i > 0 && ' or '}
          <a
            href={`mailto:${person.email}`}
            title={person.email}
            className="text-text-default hover:text-ink underline underline-offset-2 transition-colors"
          >
            {person.name}
          </a>
        </span>
      ))}
      .
    </p>
  )
}
