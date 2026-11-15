import { SkeletonLines } from '@/components/ui/skeleton'

export function LoadingText({
  className,
}: {
  label?: string
  className?: string
}) {
  return <SkeletonLines className={className} />
}
