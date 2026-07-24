'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Calendar, Check, FileQuestion } from 'lucide-react'
import {
  cycleStatusDot,
  cycleStatusLabel,
  paletteClass,
} from '@/app/(portal)/admin/applications/components/constants'
import type { Application, ApplicationTemplate, Cycle } from '@/lib/api/types'
import { formatDate } from '@/lib/utils'
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
  const role = template.application_role
  const isDraft = application?.stage === 'draft'
  const status =
    application && !isDraft ? APPLICANT_STATUS[application.stage] : null

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
      className="group rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2 text-left">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${paletteClass(cycleColorIndex)}`}
        >
          {cycle.name}
        </span>
        {status ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${status.className}`}
          >
            <Check size={12} />
            {status.label}
          </span>
        ) : (
          <span className="text-text-subtle flex shrink-0 items-center gap-1.5 text-xs">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${cycleStatusDot[cycle.status]}`}
            />
            {cycleStatusLabel[cycle.status]}
          </span>
        )}
      </div>

      <p className="text-text-secondary mt-2 text-left text-base font-medium">
        {template.title}
      </p>

      <div className="text-text-subtle -mx-4 mt-3 flex items-center justify-between gap-3 border-t border-gray-100 px-4 pt-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {template.closes_at
              ? formatDate(template.closes_at)
              : 'No deadline'}
          </span>
          <span className="flex items-center gap-1">
            <FileQuestion className="h-3.5 w-3.5" />
            {questionCount} question{questionCount === 1 ? '' : 's'}
          </span>
        </div>

        <span className="text-text-subtle group-hover:text-brand-blue flex items-center gap-1 text-sm font-medium transition-colors">
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
