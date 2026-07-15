import type { ApplicationTemplateCard } from './types'
import { cycleStatusBadge, cycleStatusLabel } from './constants'

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString()
}

export function ApplicationCard({
  template,
}: {
  template: ApplicationTemplateCard
}) {
  const opens = formatDate(template.opensAt)
  const closes = formatDate(template.closesAt)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-text-default text-sm font-medium">
          {template.cycleName}
        </p>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${cycleStatusBadge[template.cycleStatus]}`}
        >
          {cycleStatusLabel[template.cycleStatus]}
        </span>
      </div>

      {(opens || closes) && (
        <p className="text-text-subtle mt-0.5 text-xs">
          {opens ?? '—'} – {closes ?? '—'}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1">
        <span className="text-text-secondary rounded bg-gray-100 px-1.5 py-0.5 text-xs">
          {template.questionCount} question
          {template.questionCount === 1 ? '' : 's'}
        </span>
        <span className="text-text-secondary rounded bg-gray-100 px-1.5 py-0.5 text-xs">
          {template.challengeCount} challenge
          {template.challengeCount === 1 ? '' : 's'}
        </span>
      </div>

      <p className="text-text-faint mt-2 text-xs">
        {template.submissionCount} submitted application
        {template.submissionCount === 1 ? '' : 's'}
      </p>
    </div>
  )
}
