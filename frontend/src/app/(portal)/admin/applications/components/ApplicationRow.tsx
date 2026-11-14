import Link from 'next/link'
import { Code2, FileQuestion, Users } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { Badge, StatusDot } from '@/components/ui/badge'
import type { ApplicationTemplateCard } from './types'
import { cycleStatusDot, cycleStatusLabel, paletteClass } from './constants'

export function ApplicationRow({
  template,
}: {
  template: ApplicationTemplateCard
}) {
  return (
    <Link
      href={`/admin/applications/${template.cycleId}/${template.role}/builder`}
      className="block w-full border border-gray-200 bg-white px-4 py-2 transition-colors hover:bg-gray-50"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <StatusDot className={cycleStatusDot[template.status]} />
          <span className="text-text-subtle text-xs font-medium">
            {cycleStatusLabel[template.status]}
          </span>
        </div>
        <Tooltip label="Applicants">
          <span className="text-text-subtle flex items-center gap-1 text-xs">
            <Users className="h-3.5 w-3.5" />
            {template.submissionCount} applicants
          </span>
        </Tooltip>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <p className="text-text-secondary text-base font-medium">
          {template.title}
        </p>
      </div>
      <Badge className={`mt-2 ${paletteClass(template.cycleColorIndex)}`}>
        {template.cycleName}
      </Badge>

      <div className="text-text-subtle -mx-4 mt-2 flex flex-wrap items-center gap-3 border-t border-gray-200 px-4 pt-2 text-xs">
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
      </div>
    </Link>
  )
}
