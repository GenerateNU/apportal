'use client'

import { useMemo, useState } from 'react'
import { PageContainer } from '@/components/PageContainer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Role } from '@/lib/api/types'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useInterviewerPool } from '@/lib/queries/interview-assignment-plan'
import { useInterviewGroups } from '@/lib/queries/interview-groups'
import { useLeads } from '@/lib/queries/users'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { ConflictBuilder, type DraftConflict } from './ConflictBuilder'
import { GroupBuilder, type DraftGroupDay } from './GroupBuilder'
import { InterviewerPlanPanel } from './InterviewerPlanPanel'
import { MeetingDayPicker, type DraftLeadDay } from './MeetingDayPicker'
import { ReviewerPlanPanel } from './ReviewerPlanPanel'

type Stage = 'interviewer' | 'reviewer'

// Two stages, one shared meeting-day roster: a chief declares each lead's day
// once above the tabs, then plans interviewers and interview reviewers
// against it. The reviewer tab isn't gated shut before interviewers are
// assigned — its own pool naturally reports empty until then (see
// ReviewerPlanPanel), so a chief can freely check back on either stage.
export function InterviewAssignmentPlanClient() {
  const { data: cycles = [] } = useCycles({})
  const { data: leads = [] } = useLeads()

  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }
  const [role, setRole] = useState<Role>('software_engineer')
  const [perApplicant, setPerApplicant] = useState(1)
  const [meetingDays, setMeetingDays] = useState<DraftLeadDay[]>([])
  const [groupDays, setGroupDays] = useState<DraftGroupDay[]>([])
  const { data: groups = [] } = useInterviewGroups(cycleId)
  const useGroups = perApplicant > 1

  const plannedGroupDays = useMemo(
    () =>
      groups
        .filter((g) => (g.members ?? []).length > 0)
        .map((g) => ({
          groupId: g.id,
          day: groupDays.find((d) => d.groupId === g.id)?.day ?? '',
        })),
    [groupDays, groups]
  )

  const soloDays = useMemo(
    () =>
      leads.map((l) => ({
        leadNuid: l.nuid,
        day: meetingDays.find((d) => d.leadNuid === l.nuid)?.day ?? '',
      })),
    [leads, meetingDays]
  )

  const leadDays = useMemo(() => {
    if (!useGroups) return soloDays
    return leads.map((l) => {
      const group = plannedGroupDays.find((d) =>
        groups
          .find((g) => g.id === d.groupId)
          ?.members?.some((m) => m.member_nuid === l.nuid)
      )
      return { leadNuid: l.nuid, day: group?.day ?? '' }
    })
  }, [useGroups, soloDays, leads, plannedGroupDays, groups])
  const [conflicts, setConflicts] = useState<DraftConflict[]>([])
  const [stage, setStage] = useState<Stage>('interviewer')

  // The broader of the two stages' pools (every interview-stage applicant,
  // whether or not they have an interviewer yet), so the conflict picker
  // covers whoever a chief might plan for in either stage.
  const { data: pool } = useInterviewerPool(cycleId, role)

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Plan interview assignments
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Set each lead&apos;s or group&apos;s meeting day, then plan
            interviewers and interview reviewers matched to applicant
            availability. Anyone without a day is assigned to any applicant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={role} onValueChange={(val) => setRole(val as Role)}>
            <SelectTrigger className="w-56" aria-label="Applicant role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_COLUMNS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-40" aria-label="Cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="interviewers-per-applicant" className="text-xs">
            Interviewers per applicant
          </Label>
          <Input
            id="interviewers-per-applicant"
            type="number"
            min={1}
            max={Math.max(1, leads.length)}
            value={perApplicant}
            className="h-9 w-40"
            onChange={(e) =>
              setPerApplicant(Math.max(1, Number(e.target.value) || 1))
            }
          />
        </div>
        <p className="text-text-muted max-w-md text-xs">
          {useGroups
            ? `Leads interview in groups of ${perApplicant}. Each group shares one meeting day and is assigned as a unit.`
            : 'Each applicant gets one lead. Set 2 or more to interview in groups.'}
        </p>
      </section>

      {useGroups ? (
        <GroupBuilder
          cycleId={cycleId}
          leads={leads}
          groups={groups}
          size={perApplicant}
          days={groupDays}
          onDaysChange={setGroupDays}
        />
      ) : (
        <MeetingDayPicker
          leads={leads}
          value={meetingDays}
          onChange={setMeetingDays}
        />
      )}

      <ConflictBuilder
        leads={leads}
        applicants={pool?.applicants ?? []}
        value={conflicts}
        onChange={setConflicts}
      />

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <StageTab
          active={stage === 'interviewer'}
          onClick={() => setStage('interviewer')}
        >
          1. Interviewers
        </StageTab>
        <StageTab
          active={stage === 'reviewer'}
          onClick={() => setStage('reviewer')}
        >
          2. Interview reviewers
        </StageTab>
      </div>

      {stage === 'interviewer' ? (
        <InterviewerPlanPanel
          cycleId={cycleId}
          role={role}
          meetingDays={useGroups ? [] : soloDays}
          groupDays={useGroups ? plannedGroupDays : []}
          conflicts={conflicts}
        />
      ) : (
        <ReviewerPlanPanel
          cycleId={cycleId}
          role={role}
          meetingDays={leadDays}
          conflicts={conflicts}
        />
      )}
    </PageContainer>
  )
}

function StageTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'text-text-default bg-white shadow-sm'
          : 'text-text-muted hover:text-text-default'
      }`}
    >
      {children}
    </button>
  )
}
