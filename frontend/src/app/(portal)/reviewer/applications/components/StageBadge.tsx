import type { ApplicationStage } from '@/lib/api/types'
import { stageBadge, stageLabel } from './constants'

export function StageBadge({ stage }: { stage: ApplicationStage }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${stageBadge[stage]}`}
    >
      {stageLabel[stage]}
    </span>
  )
}
