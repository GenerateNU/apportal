import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gray-50 px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-gray-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-text-default text-lg font-semibold">
          Page not found
        </h1>
        <p className="text-text-muted text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link href="/" className={buttonVariants()}>
          Back to portal
        </Link>
      </div>
    </div>
  )
}
