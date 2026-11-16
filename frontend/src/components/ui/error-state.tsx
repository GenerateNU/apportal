import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this. It's usually temporary, so try again in a moment.",
  reference,
  onRetry,
  className,
}: {
  title?: string
  description?: React.ReactNode
  reference?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex w-full max-w-md flex-col items-start gap-4 border border-gray-200 bg-white p-6',
        className
      )}
      style={{ animation: 'gen-error-in 0.3s ease-out both' }}
    >
      <span className="bg-ink font-display flex size-10 items-center justify-center text-lg font-bold text-white">
        !
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-ink text-lg font-bold tracking-tight uppercase">
          {title}
        </h2>
        <p className="text-text-muted text-sm">{description}</p>
      </div>
      {reference && (
        <p className="font-display text-text-subtle text-[11px] tracking-wider break-all uppercase">
          Reference {reference}
        </p>
      )}
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  )
}
