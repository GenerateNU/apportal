import { cn } from '@/lib/utils'
import { isValidElement } from 'react'
import { type Crumb, Breadcrumbs } from './breadcrumbs'
import { StickyBar } from './sticky-bar'

function isTopLevelCrumb(back: React.ReactNode) {
  return (
    isValidElement<{ items?: Crumb[] }>(back) &&
    back.type === Breadcrumbs &&
    (back.props.items?.length ?? 0) <= 1
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  size = 'lg',
  className,
  crumbSpace = true,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  back?: React.ReactNode
  size?: 'lg' | 'md'
  className?: string
  crumbSpace?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {back && !isTopLevelCrumb(back) ? (
        <StickyBar>{back}</StickyBar>
      ) : (
        crumbSpace && (
          <div aria-hidden className="invisible">
            <Breadcrumbs items={[{ label: '\u00a0' }]} />
          </div>
        )
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="max-w-2xl min-w-0 flex-[1_1_20rem]">
          <h1
            className={cn(
              'font-display text-ink font-bold tracking-tight uppercase',
              size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl'
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <div className="text-text-muted mt-1 text-sm">{subtitle}</div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
