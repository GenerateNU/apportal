import Image from 'next/image'
import Link from 'next/link'
import { HelpContact } from '@/components/HelpContact'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BackButton, CopyReference, RetryButton } from './ErrorScreenActions'

export function ErrorScreen({
  code,
  title,
  message,
  digest,
  retry,
  homeHref = '/',
  fullPage = false,
}: {
  code: string
  title: string
  message: string
  digest?: string
  retry?: () => void
  homeHref?: string
  fullPage?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center px-4 py-16',
        fullPage && 'min-h-dvh bg-gray-50'
      )}
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {fullPage && (
          <Image
            src="/GenerateNU Logo.png"
            alt="GenerateNU"
            width={36}
            height={36}
            className="mb-8 object-contain"
          />
        )}
        <p className="font-display text-7xl leading-none font-bold tracking-tight text-gray-200 select-none">
          {code}
        </p>
        <h1 className="font-display text-ink mt-4 text-2xl font-bold tracking-tight uppercase">
          {title}
        </h1>
        <p className="text-text-muted mt-2 max-w-sm text-sm">{message}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {retry ? (
            <RetryButton retry={retry} />
          ) : (
            <Link href={homeHref} className={buttonVariants()}>
              Back to home
            </Link>
          )}
          <BackButton />
          {retry && (
            <Link
              href={homeHref}
              className={buttonVariants({ variant: 'ghost' })}
            >
              Home
            </Link>
          )}
        </div>
        {digest && <CopyReference digest={digest} />}
        <HelpContact className="mt-10 max-w-sm" />
      </div>
    </div>
  )
}
