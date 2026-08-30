import Image from 'next/image'
import { Tooltip } from '@/components/Tooltip'

// The club's own logo is the mark: a returner is someone who's already been on
// a Generate project, and the logo reads faster in a dense row than yet
// another colored word-pill. Decorative alt, with the tooltip label carrying
// the meaning for screen readers too.
export function ReturnerBadge({ showLabel = false }: { showLabel?: boolean }) {
  return (
    <Tooltip label="Been in Generate previously">
      <span className="inline-flex w-fit shrink-0 items-center gap-1">
        <Image
          src="/GenerateNU Logo.png"
          alt=""
          width={12}
          height={12}
          className="object-contain"
        />
        <span
          className={
            showLabel ? 'text-brand-blue text-xs font-medium' : 'sr-only'
          }
        >
          Returner
        </span>
      </span>
    </Tooltip>
  )
}
