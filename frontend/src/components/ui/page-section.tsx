import { SECTION } from '@/components/ui/page-shell'
import { Subheading } from '@/components/ui/subheading'
import { cn } from '@/lib/utils'

export function PageSection({
  label,
  hint,
  className,
  children,
}: {
  label?: React.ReactNode
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn(SECTION, className)}>
      {label && <Subheading title={label} hint={hint} />}
      {children}
    </section>
  )
}
