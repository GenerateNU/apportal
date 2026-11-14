'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Calendar, FileQuestion } from 'lucide-react'
import {
  cycleStatusDot,
  cycleStatusLabel,
  paletteClass,
} from '@/app/(portal)/admin/applications/components/constants'
import type { Application, ApplicationTemplate, Cycle } from '@/lib/api/types'
import { formatDate } from '@/lib/utils'
import { Badge, StatusDot } from '@/components/ui/badge'
import { APPLICANT_STATUS } from '../lib/status'

interface ApplicationRoleCardProps {
  cycle: Cycle
  cycleColorIndex: number
  template: ApplicationTemplate
  questionCount: number
  application?: Application
}

export function ApplicationRoleCard({
  cycle,
  cycleColorIndex,
  template,
  questionCount,
  application,
}: ApplicationRoleCardProps) {
  const router = useRouter()
  const role = template.role_id
  const isDraft = application?.stage === 'draft'
  const status =
    application && !isDraft ? APPLICANT_STATUS[application.stage] : null

  // Not gated on comparing template.closes_at against the browser's own
  // clock — a device with the wrong time or timezone would then lock
  // someone out of a role that's actually still open, with no way to
  // recover since this card never talks to the backend. The real deadline
  // check happens server-side once they actually try to save/submit (see
  // NewApplicationForm), which is the only trustworthy clock.
  const handleClick = () => {
    if (isDraft) {
      router.push(`/applicant/applications/new?cycle=${cycle.id}&role=${role}`)
    } else if (application) {
      router.push(`/applicant/applications/${application.id}`)
    } else {
      router.push(`/applicant/applications/new?cycle=${cycle.id}&role=${role}`)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group min-w-0 border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50"
    >
      <div className="flex items-center justify-between gap-2 text-left">
        <Badge className={`min-w-0 truncate ${paletteClass(cycleColorIndex)}`}>
          {cycle.name}
        </Badge>
        {status ? (
          <span className="text-text-subtle flex shrink-0 items-center gap-1.5 text-xs">
            <StatusDot className="bg-gray-400" />
            {status.label}
          </span>
        ) : (
          <span className="text-text-subtle flex shrink-0 items-center gap-1.5 text-xs">
            <StatusDot className={cycleStatusDot[cycle.status]} />
            {cycleStatusLabel[cycle.status]}
          </span>
        )}
      </div>

      <p className="text-text-secondary mt-2 text-left text-base font-medium">
        {template.title}
      </p>

      <div className="text-text-subtle -mx-4 mt-3 flex items-center justify-between gap-3 border-t border-gray-100 px-4 pt-3 text-xs">
        <div className="flex items-center gap-3">
          {template.closes_at ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(template.closes_at)}
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <FileQuestion className="h-3.5 w-3.5" />
            {questionCount} question{questionCount === 1 ? '' : 's'}
          </span>
        </div>

        <span className="text-text-subtle group-hover:text-ink flex items-center gap-1 text-sm font-medium transition-colors">
          {isDraft ? (
            <>
              Continue
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </>
          ) : application ? (
            <>
              View
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </>
          ) : (
            <>
              Apply
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </>
          )}
        </span>
      </div>
    </button>
  )
}
