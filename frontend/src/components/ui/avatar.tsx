import { cn } from '@/lib/utils'

// A fixed set of profile colors; a given name always hashes to the same one.
const PROFILE_COLORS = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-cyan-600',
] as const

function hashToBucket(value: string, bucketCount: number) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % bucketCount
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
} as const

interface AvatarProps {
  name: string
  size?: keyof typeof sizeClasses
  className?: string
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  // Callers occasionally have this in a loading/unresolved state (e.g. a
  // profile fetch that hasn't returned yet) despite the required prop type.
  const safeName = name || ''
  const colorClass =
    PROFILE_COLORS[hashToBucket(safeName, PROFILE_COLORS.length)]

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {initials(safeName)}
    </div>
  )
}
