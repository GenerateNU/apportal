import { Clock, Code2, FileQuestion, Users } from 'lucide-react'
import type { ApplicationTemplateCard } from './types'
import { cycleStatusDot, cycleStatusLabel, roleLabel } from './constants'

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ApplicationCard({
  template,
}: {
  template: ApplicationTemplateCard
}) {
  const closes = formatDate(template.closesAt)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-text-default text-base font-semibold">
          {roleLabel[template.role]} Application
        </p>
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${cycleStatusDot[template.cycleStatus]}`}
          title={cycleStatusLabel[template.cycleStatus]}
        />
      </div>
      <p className="text-text-subtle mt-1 text-sm">{template.cycleName}</p>

      <div className="text-text-subtle mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1">
          <FileQuestion className="h-3.5 w-3.5" />
          {template.questionCount}
        </span>
        <span className="flex items-center gap-1">
          <Code2 className="h-3.5 w-3.5" />
          {template.challengeCount}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {template.submissionCount}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {closes ?? 'No deadline'}
        </span>
      </div>
    </div>
  )
}
