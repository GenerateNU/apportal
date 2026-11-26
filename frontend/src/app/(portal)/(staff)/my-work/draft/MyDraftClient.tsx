'use client'

import { useState } from 'react'
import { CalendarDays, ChevronRight, Users } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { LiveDot } from '@/components/ui/live-dot'
import { Badge } from '@/components/ui/badge'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { PanelHeading } from '@/components/ui/panel-heading'
import { SearchInput } from '@/components/ui/search-input'
import {
  ApplicationDetail,
  toApplicantDetail,
} from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/ApplicationDetail'
import { myWorkCrumbs } from '@/app/(portal)/(staff)/my-work/crumbs'
import { roundOf } from '@/app/(portal)/(staff)/cycles/[cycleId]/draft/components/snake'
import type {
  ApplicationSummary,
  DraftBoard,
  DraftPickDetail,
  PreferenceListDetail,
} from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { useCycleScope } from '@/hooks/useCycleScope'
import { useIsChief } from '@/lib/queries/cycle-staff'
import { useDraftBoards, useDraftedApplications } from '@/lib/queries/drafts'
import { usePreferenceListDetails } from '@/lib/queries/preference-lists'
import { useCycleRoles } from '@/lib/queries/roles'
import { useCurrentUser } from '@/lib/queries/users'
import { cn } from '@/lib/utils'
import { Fact, Facts } from '@/components/ui/facts'

const CRUMBS = myWorkCrumbs('draft')

type RoleBoard = { roleId: string; board?: DraftBoard }

const isOpen = (b?: DraftBoard): b is DraftBoard =>
  !!b && (b.status === 'active' || b.status === 'complete')

export function MyDraftClient() {
  const { data: user } = useCurrentUser()
  const { cycle, isLoading: cyclesLoading } = useCycleScope(
    useIsChief() ? 'chief' : 'lead'
  )
  const cycleId = cycle?.id ?? ''

  const { roleIds, roleLabel } = useCycleRoles(cycleId)
  const { data: drafted = {} } = useDraftedApplications(cycleId)
  const { data: groups = [], isLoading: groupsLoading } =
    usePreferenceListDetails(cycleId)
  const myGroup = groups.find((g) =>
    (g.members ?? []).some((m) => m.lead_nuid === user?.nuid)
  )
  const { data: boardsByRole, isPending } = useDraftBoards(cycleId, roleIds)
  const boardsPending = roleIds.length > 0 && isPending
  const boards = roleIds.map((roleId): RoleBoard => ({
    roleId,
    board: boardsByRole?.[roleId],
  }))

  if (cyclesLoading) {
    return (
      <div className={PAGE_SHELL}>
        <LoadingText />
      </div>
    )
  }

  const live = boards.filter((b) => isOpen(b.board))

  return (
    <div className={PAGE_SHELL}>
      <div className="flex flex-col gap-3">
        <PageHeader
          back={<Breadcrumbs items={CRUMBS} />}
          title="Draft"
          subtitle={
            <Facts>
              {cycle?.name && <Fact icon={CalendarDays}>{cycle.name}</Fact>}
              {myGroup?.name && <Fact icon={Users}>{myGroup.name}</Fact>}
            </Facts>
          }
        />
      </div>

      {!cycleId ? (
        <EmptyState
          title="No cycle yet"
          description="You aren't on staff for a cycle, so there's no draft to follow."
        />
      ) : boardsPending || groupsLoading ? (
        <LoadingText />
      ) : live.length === 0 ? (
        <EmptyState
          title="Draft not open"
          description="It opens once preference lists lock and a chief starts the draft."
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-10">
            <StatusRows
              boards={boards}
              myGroup={myGroup}
              drafted={drafted}
              roleLabel={roleLabel}
            />
            <TeamsBoard boards={live} myGroup={myGroup} roleLabel={roleLabel} />
            <OurLists
              roleIds={live.map((b) => b.roleId)}
              myGroup={myGroup}
              drafted={drafted}
              roleLabel={roleLabel}
            />
          </div>
          <PoolSidebar
            cycleId={cycleId}
            roleIds={live.map((b) => b.roleId)}
            myGroup={myGroup}
            roleLabel={roleLabel}
          />
        </div>
      )}
    </div>
  )
}

function ourEntries(myGroup: PreferenceListDetail | undefined, roleId: string) {
  return (myGroup?.entries ?? [])
    .filter((e) => e.role_id === roleId)
    .sort((a, b) => a.rank - b.rank)
}

function StatusRows({
  boards,
  myGroup,
  drafted,
  roleLabel,
}: {
  boards: RoleBoard[]
  myGroup?: PreferenceListDetail
  drafted: Record<string, string>
  roleLabel: (id: string) => string
}) {
  return (
    <div className="border border-gray-200 bg-white">
      {boards.map(({ roleId, board }) => {
        const open = isOpen(board)
        const teams = board?.teams ?? []
        const myTeam = teams.find((t) => t.preference_list_id === myGroup?.id)
        const onClock = teams.find((t) => t.id === board?.on_the_clock_team_id)
        const complete =
          !!board && (board.status === 'complete' || !board.on_the_clock)
        const usUp = open && !complete && !!myTeam && myTeam.id === onClock?.id
        const next = ourEntries(myGroup, roleId).find(
          (e) => !drafted[e.application_id]
        )
        const total = (board?.rounds ?? 0) * teams.length
        return (
          <div
            key={roleId}
            className={cn(
              'flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 not-first:border-t not-first:border-gray-200',
              usUp && 'bg-ink text-white'
            )}
          >
            <span className="font-display w-44 shrink-0 text-sm font-bold tracking-wider uppercase">
              {roleLabel(roleId)}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
              {open && !complete && <LiveDot label="Live" />}
              {!open
                ? 'Not open yet'
                : complete
                  ? 'Draft complete'
                  : usUp
                    ? "You're on the clock"
                    : `${onClock?.name ?? 'Next team'} is picking`}
              {open && !complete && board && (
                <span className="flex flex-wrap gap-1.5 font-normal">
                  <Badge
                    size="sm"
                    className={usUp ? 'bg-white/15 text-white' : undefined}
                  >
                    Round {roundOf(board.on_the_clock, teams.length)}
                  </Badge>
                  <Badge
                    size="sm"
                    className={usUp ? 'bg-white/15 text-white' : undefined}
                  >
                    Pick {board.on_the_clock} of {total}
                  </Badge>
                </span>
              )}
            </span>
            {open && myGroup && (
              <span
                className={cn(
                  'min-w-0 text-sm wrap-anywhere',
                  usUp ? 'text-white' : 'text-text-muted'
                )}
              >
                {next ? (
                  <>
                    Next on our list{' '}
                    <strong className={usUp ? 'text-white' : 'text-ink'}>
                      {next.full_name}
                    </strong>
                  </>
                ) : (
                  'Nobody left on our list'
                )}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TeamsBoard({
  boards,
  myGroup,
  roleLabel,
}: {
  boards: RoleBoard[]
  myGroup?: PreferenceListDetail
  roleLabel: (id: string) => string
}) {
  const order = new Map<string, { name: string; position: number }>()
  for (const { board } of boards) {
    for (const t of board?.teams ?? []) {
      if (!order.has(t.preference_list_id)) {
        order.set(t.preference_list_id, { name: t.name, position: t.position })
      }
    }
  }
  const teams = [...order.entries()].sort(
    (a, b) => a[1].position - b[1].position
  )

  return (
    <section className="flex flex-col gap-3">
      <PanelHeading aside="Picks by team">Teams</PanelHeading>
      <div className="border border-gray-200 bg-white">
        {teams.map(([listId, { name }]) => (
          <TeamRow
            key={listId}
            name={name}
            ours={listId === myGroup?.id}
            roleLabel={roleLabel}
            roles={boards.map(({ roleId, board }) => {
              const team = board?.teams?.find(
                (t) => t.preference_list_id === listId
              )
              return {
                roleId,
                picks: (board?.picks ?? [])
                  .filter((p) => p.draft_team_id === team?.id)
                  .sort((a, b) => a.pick_number - b.pick_number),
                picking:
                  board?.status === 'active' &&
                  !!team &&
                  board.on_the_clock_team_id === team.id,
              }
            })}
          />
        ))}
      </div>
    </section>
  )
}

function TeamRow({
  name,
  ours,
  roles,
  roleLabel,
}: {
  name: string
  ours: boolean
  roles: { roleId: string; picks: DraftPickDetail[]; picking: boolean }[]
  roleLabel: (id: string) => string
}) {
  const [open, setOpen] = useState(true)
  const pickingNow = roles.some((r) => r.picking)

  return (
    <div className="not-first:border-t not-first:border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-gray-50',
          ours && 'bg-gray-50'
        )}
      >
        <ChevronRight
          size={14}
          className={cn(
            'text-text-subtle shrink-0 transition-transform',
            open && 'rotate-90'
          )}
        />
        <span className="text-ink flex min-w-0 flex-1 items-center gap-2 font-semibold wrap-anywhere">
          {name}
          {ours && (
            <Badge size="sm" className="text-text-muted">
              You
            </Badge>
          )}
        </span>
        {pickingNow && (
          <span className="text-ink flex items-center gap-1.5 text-xs font-semibold">
            <LiveDot label="Picking now" />
            Picking now
          </span>
        )}
      </button>
      {open && (
        <div className="grid gap-4 border-t border-gray-100 px-4 py-3 pl-10 sm:grid-cols-2">
          {roles.map(({ roleId, picks }) => (
            <div key={roleId} className="flex min-w-0 flex-col gap-1.5">
              <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
                {roleLabel(roleId)}
              </span>
              {picks.length === 0 ? (
                <span className="text-text-subtle text-sm">No picks yet</span>
              ) : (
                <ol className="flex flex-col gap-1">
                  {picks.map((p) => (
                    <li key={p.id} className="flex gap-2 text-sm">
                      <span className="text-ink min-w-0 wrap-anywhere">
                        {p.full_name}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OurLists({
  roleIds,
  myGroup,
  drafted,
  roleLabel,
}: {
  roleIds: string[]
  myGroup?: PreferenceListDetail
  drafted: Record<string, string>
  roleLabel: (id: string) => string
}) {
  if (!myGroup) {
    return (
      <EmptyState
        size="sm"
        title="You aren't on a preference list team in this cycle."
      />
    )
  }
  return (
    <section className="flex flex-col gap-3">
      <PanelHeading aside={myGroup.name}>Our lists, live</PanelHeading>
      <div className="grid gap-6 md:grid-cols-2">
        {roleIds.map((roleId) => {
          const ours = ourEntries(myGroup, roleId)
          const next = ours.find((e) => !drafted[e.application_id])
          const left = ours.filter((e) => !drafted[e.application_id]).length
          return (
            <div key={roleId} className="flex min-w-0 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-ink text-xs font-bold tracking-wider uppercase">
                  {roleLabel(roleId)}
                </span>
                <span className="text-text-muted text-xs">{left} left</span>
              </div>
              {ours.length === 0 ? (
                <p className="text-text-faint border border-dashed border-gray-200 px-4 py-6 text-center text-sm">
                  Nobody ranked
                </p>
              ) : (
                <ol className="border border-gray-200 bg-white">
                  {ours.map((e, i) => {
                    const by = drafted[e.application_id]
                    const isNext = e.application_id === next?.application_id
                    return (
                      <li
                        key={e.id}
                        className={cn(
                          'flex min-w-0 items-baseline gap-3 px-4 py-2 not-first:border-t not-first:border-gray-200',
                          isNext && 'bg-green-50'
                        )}
                      >
                        <span className="font-display text-ink w-5 shrink-0 text-right text-sm font-bold">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block text-sm wrap-anywhere',
                              by
                                ? 'text-text-subtle line-through'
                                : 'text-ink font-semibold'
                            )}
                          >
                            {e.full_name}
                          </span>
                          {(by || isNext) && (
                            <span
                              className={cn(
                                'text-xs',
                                isNext ? 'text-green-700' : 'text-text-muted'
                              )}
                            >
                              {by ? `Drafted by ${by}` : 'Next up for us'}
                            </span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PoolSidebar({
  cycleId,
  roleIds,
  myGroup,
  roleLabel,
}: {
  cycleId: string
  roleIds: string[]
  myGroup?: PreferenceListDetail
  roleLabel: (id: string) => string
}) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [openApp, setOpenApp] = useState<ApplicationSummary | null>(null)
  const { data: pool = [], isLoading: poolLoading } = useApplications(
    { cycle_id: cycleId, stages: 'selection' },
    undefined,
    { enabled: !!cycleId }
  )
  const ourRank = new Map<string, number>()
  for (const roleId of roleIds) {
    ourEntries(myGroup, roleId).forEach((e, i) =>
      ourRank.set(e.application_id, i + 1)
    )
  }
  const q = query.trim().toLowerCase()
  const shown = pool
    .filter((a) => roleIds.includes(a.role_id))
    .filter((a) => !roleFilter || a.role_id === roleFilter)
    .filter((a) => !q || (a.full_name || '').toLowerCase().includes(q))
    .sort(
      (a, b) =>
        (ourRank.get(a.id) ?? 999) - (ourRank.get(b.id) ?? 999) ||
        (a.full_name || '').localeCompare(b.full_name || '')
    )

  return (
    <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start">
      <PanelHeading aside={`${shown.length} available`}>Pool</PanelHeading>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search applicants"
        className="sm:w-full"
      />
      {roleIds.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {['', ...roleIds].map((r) => (
            <button
              key={r || 'all'}
              type="button"
              onClick={() => setRoleFilter(r)}
              aria-pressed={roleFilter === r}
              className={cn(
                'border px-2.5 py-1 text-xs transition-colors',
                roleFilter === r
                  ? 'border-ink bg-ink text-white'
                  : 'text-ink border-gray-200 bg-white hover:border-gray-400'
              )}
            >
              {r ? roleLabel(r) : 'All roles'}
            </button>
          ))}
        </div>
      )}
      {poolLoading ? (
        <LoadingText />
      ) : shown.length === 0 ? (
        <p className="text-text-faint py-6 text-center text-sm">
          {q ? 'Nobody matches that search.' : 'Everyone has been drafted.'}
        </p>
      ) : (
        <ul className="min-h-0 overflow-y-auto border border-gray-200 bg-white max-lg:max-h-96">
          {shown.map((a) => {
            const rank = ourRank.get(a.id)
            return (
              <li
                key={a.id}
                className="flex min-w-0 items-baseline gap-3 px-3 py-2 not-first:border-t not-first:border-gray-200"
              >
                <span className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setOpenApp(a)}
                    className="text-ink block text-left text-sm wrap-anywhere underline-offset-2 hover:underline"
                  >
                    {a.full_name || a.user_nuid}
                  </button>
                  {roleIds.length > 1 && (
                    <span className="text-text-muted text-xs">
                      {roleLabel(a.role_id)}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs',
                    rank ? 'text-ink font-semibold' : 'text-text-subtle'
                  )}
                >
                  {rank ? `#${rank} on ours` : 'Not on ours'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {openApp && (
        <ApplicationDetail
          applicant={toApplicantDetail(openApp)}
          onClose={() => setOpenApp(null)}
        />
      )}
    </aside>
  )
}
