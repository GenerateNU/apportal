import { cn } from '@/lib/utils'
import { PAGE_TOP, PAGE_X } from '@/components/ui/page-shell'

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse bg-gray-100', className)}
    />
  )
}

const LINE_WIDTHS = ['w-3/4', 'w-full', 'w-5/6', 'w-2/3', 'w-11/12']

export function SkeletonLines({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('flex flex-col gap-2.5', className)}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', LINE_WIDTHS[i % 5])} />
      ))}
    </div>
  )
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('flex w-full flex-col gap-8 pb-12', PAGE_X, PAGE_TOP)}
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-28" />
        ))}
      </div>
      <div className="border border-gray-200 bg-white">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 border-b border-gray-200 px-4 py-4 last:border-b-0"
          >
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}
