import { cn } from '@/lib/utils'

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' } as const

// "raised" is a top-level panel; "flat" nests inside one.
export function Card({
  variant = 'raised',
  padding = 'md',
  interactive,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  variant?: 'raised' | 'flat'
  padding?: keyof typeof PADDING
  interactive?: boolean
}) {
  return (
    <div
      className={cn(
        'bg-white',
        variant === 'raised'
          ? 'border border-gray-200'
          : 'border border-gray-100',
        PADDING[padding],
        interactive && 'transition-colors hover:bg-gray-50',
        className
      )}
      {...props}
    />
  )
}

export function Toolbar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <Card
      className={cn('flex flex-wrap items-center gap-3', className)}
      {...props}
    />
  )
}
