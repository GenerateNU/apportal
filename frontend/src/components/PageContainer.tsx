import { PAGE_SHELL } from '@/components/ui/page-shell'
import { cn } from '@/lib/utils'

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(PAGE_SHELL, className)}>{children}</div>
}
