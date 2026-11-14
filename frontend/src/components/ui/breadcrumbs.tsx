import Link from 'next/link'
import { cn } from '@/lib/utils'

export type Crumb = { label: string; href?: string; onClick?: () => void }

const LINK_CLASS =
  'text-text-subtle hover:text-ink underline-offset-4 hover:underline'

export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[]
  className?: string
}) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="font-display flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-wider uppercase">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${i}-${item.label}`} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-ink">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link href={item.href} className={LINK_CLASS}>
                  {item.label}
                </Link>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className={cn(LINK_CLASS, 'uppercase')}
                >
                  {item.label}
                </button>
              ) : (
                <span className="text-text-subtle">{item.label}</span>
              )}
              {!last && <span className="text-text-faint">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
