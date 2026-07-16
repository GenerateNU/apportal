import { Clock, Code2, FileQuestion, Users } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import type { ApplicationTemplateCard } from './types'
import {
  cycleStatusDot,
  cycleStatusLabel,
  paletteClass,
  roleLabel,
} from './constants'

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ApplicationRow({
  template,
}: {
  template: ApplicationTemplateCard
}) {
  const closes = formatDate(template.closesAt)

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${cycleStatusDot[template.cycleStatus]}`}
          />
          <span className="text-text-subtle text-xs font-medium">
            {cycleStatusLabel[template.cycleStatus]}
          </span>
        </div>
        <Tooltip label="Applicants">
          <span className="text-text-subtle flex items-center gap-1 text-xs">
            <Users className="h-3.5 w-3.5" />
            {template.submissionCount} applicants
          </span>
        </Tooltip>
      </div>

      <p className="text-text-secondary mt-2 text-base font-medium">
        {roleLabel[template.role]} Application
      </p>
      <span
        className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${paletteClass(template.cycleColorIndex)}`}
      >
        {template.cycleName}
      </span>

      <div className="text-text-subtle -mx-4 mt-3 flex flex-wrap items-center gap-3 border-t border-gray-200 px-4 pt-2 text-xs">
        <Tooltip label="Questions">
          <span className="flex items-center gap-1">
            <FileQuestion className="h-3.5 w-3.5" />
            {template.questionCount}
          </span>
        </Tooltip>
        <Tooltip label="Challenges">
          <span className="flex items-center gap-1">
            <Code2 className="h-3.5 w-3.5" />
            {template.challengeCount}
          </span>
        </Tooltip>
        <Tooltip label="Closing date">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {closes ?? 'No deadline'}
          </span>
        </Tooltip>
      </div>
    </div>
  )
}
