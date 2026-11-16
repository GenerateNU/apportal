'use client'

import { ReturnerBadge } from '@/components/ReturnerBadge'
import { useRoleLookup } from '@/lib/queries/roles'
import type { ApplicantApplication } from './types'
import { StageSelect } from './StageSelect'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export function KanbanCard({
  applicant,
  availabilityDays,
  editable,
  onOpen,
}: {
  applicant: ApplicantApplication
  availabilityDays: string[]
  editable: boolean
  onOpen: () => void
}) {
  const { roleLabel, roleChipClass } = useRoleLookup()
  return (
    <Card padding="sm">
      <button
        type="button"
        onClick={onOpen}
        className="text-text-default block w-full text-left text-sm font-medium wrap-anywhere underline-offset-2 hover:underline"
      >
        {applicant.fullName}
      </button>
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        <Badge size="sm" className={roleChipClass(applicant.role)}>
          {roleLabel(applicant.role)}
        </Badge>
        {applicant.returner && <ReturnerBadge />}
        {availabilityDays.map((d) => (
          <Badge key={d} size="sm" className="text-text-secondary">
            {d}
          </Badge>
        ))}
      </div>
      <div className="mt-2.5">
        <StageSelect
          applicationId={applicant.id}
          stage={applicant.stage}
          editable={editable}
        />
      </div>
    </Card>
  )
}
