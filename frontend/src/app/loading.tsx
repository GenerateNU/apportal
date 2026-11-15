import { PageSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-dvh bg-white">
      <PageSkeleton />
    </div>
  )
}
