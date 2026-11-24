'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Trash2, Users } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Badge, Count } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PREFERENCE_LIST_STATUS_BADGE,
  PREFERENCE_LIST_STATUS_LABEL,
} from '@/lib/preference-list-status'
import { useApplication } from '@/lib/queries/applications'
import {
  useDeletePreferenceList,
  usePreferenceList,
} from '@/lib/queries/preference-lists'
import { useCycleRoles } from '@/lib/queries/roles'
import { useReviewerNames } from '@/lib/queries/users'
import { MEETING_DAY_LABEL } from '@/app/(portal)/reviewer/applications/components/meetingAvailability'
import { MembersDialog } from './MembersDialog'
import { ApplicationDetail } from '@/app/(portal)/reviewer/applications/components/ApplicationDetail'
import { Fact, Facts } from '@/components/ui/facts'

const CRUMB = {
  label: 'Teams & preference lists',
  href: '/reviewer/preference-lists',
}

export function ChiefTeamClient({ id }: { id: string }) {
  const router = useRouter()
  const {
    data: list,
    isLoading,
    isError,
  } = usePreferenceList(id, { poll: true })
  const { roleIds, roleLabel } = useCycleRoles(list?.cycle_id ?? '')
  const nameByNuid = useReviewerNames()
  const deleteList = useDeletePreferenceList()
  const [confirming, setConfirming] = useState(false)
  const [editingMembers, setEditingMembers] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pickedRole, setPickedRole] = useState('')
  const { data: openApp } = useApplication(openId ?? '')

  if (isError) {
    return (
      <PageContainer>
        <PageHeader
          back={<Breadcrumbs items={[CRUMB, { label: 'Team' }]} />}
          title="Team not found"
        />
      </PageContainer>
    )
  }
  if (isLoading || !list) {
    return (
      <PageContainer>
        <LoadingText />
      </PageContainer>
    )
  }

  const members = list.members.map(
    (m) => nameByNuid.get(m.lead_nuid) ?? m.lead_nuid
  )
  const subtitle = (
    <Facts>
      <Fact icon={Users}>
        {members.length > 0 ? members.join(', ') : 'No members yet'}
      </Fact>
      {list.meeting_day && (
        <Fact icon={CalendarDays}>
          Meets {MEETING_DAY_LABEL[list.meeting_day]}
        </Fact>
      )}
    </Facts>
  )
  const openEntry = list.entries.find((e) => e.application_id === openId)
  const role = roleIds.includes(pickedRole) ? pickedRole : roleIds[0]
  const entries = list.entries
    .filter((e) => e.role_id === role)
    .sort((a, b) => a.rank - b.rank)

  return (
    <PageContainer>
      <PageHeader
        back={<Breadcrumbs items={[CRUMB, { label: list.name }]} />}
        title={
          <span className="inline-flex items-center gap-3">
            {list.name}
            <Badge
              className={cn(
                'font-sans tracking-normal normal-case',
                PREFERENCE_LIST_STATUS_BADGE[list.status]
              )}
            >
              {PREFERENCE_LIST_STATUS_LABEL[list.status]}
            </Badge>
          </span>
        }
        subtitle={subtitle}
        actions={
          <>
            {roleIds.length > 1 && (
              <Select value={role} onValueChange={setPickedRole}>
                <SelectTrigger className="h-9 w-52" aria-label="Position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleIds.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="inline-flex items-center gap-2">
                        {roleLabel(r)}
                        <Count
                          value={
                            list.entries.filter((e) => e.role_id === r).length
                          }
                        />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => setEditingMembers(true)}>
              <Users size={14} />
              Members
              <Count value={list.members.length} />
            </Button>
            <Button variant="outline" onClick={() => setConfirming(true)}>
              <Trash2 size={14} />
              Delete team
            </Button>
          </>
        }
      />

      {role && (
        <>
          {entries.length === 0 ? (
            <EmptyState title="No one ranked yet" />
          ) : (
            <Card padding="none" className="divide-y divide-gray-100">
              {entries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setOpenId(e.application_id)}
                  className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-gray-50"
                >
                  <span className="text-text-subtle w-6 shrink-0 text-sm tabular-nums">
                    {e.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-sm font-medium">
                      {e.full_name}
                    </p>
                    {e.reasoning && (
                      <p className="text-text-muted truncate text-xs">
                        {e.reasoning}
                      </p>
                    )}
                  </div>
                  {e.returner && (
                    <Badge size="sm" className="text-text-muted bg-gray-100">
                      Returner
                    </Badge>
                  )}
                </button>
              ))}
            </Card>
          )}
        </>
      )}

      {openEntry && openApp && (
        <ApplicationDetail
          applicant={{
            id: openApp.id,
            nuid: openApp.user_nuid,
            fullName: openEntry.full_name,
            email: openEntry.email,
            role: openApp.role_id,
            cycleId: openApp.cycle_id,
            stage: openApp.stage,
            submittedAt: openApp.submitted_at,
            returner: openEntry.returner,
          }}
          onClose={() => setOpenId(null)}
        />
      )}

      <MembersDialog
        open={editingMembers}
        onOpenChange={setEditingMembers}
        list={list}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this team?"
        description={`${list.name} and its rankings are deleted for everyone.`}
        confirmLabel="Delete team"
        pending={deleteList.isPending}
        onConfirm={() =>
          deleteList.mutate(
            { id: list.id, cycleId: list.cycle_id },
            {
              onSuccess: () =>
                router.push(
                  `/reviewer/preference-lists?cycle=${list.cycle_id}`
                ),
            }
          )
        }
      />
    </PageContainer>
  )
}
