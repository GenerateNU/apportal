'use client'

import { useState } from 'react'
import { CalendarDays, Users } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { SearchInput } from '@/components/ui/search-input'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ApplicationDetail,
  toApplicantDetail,
} from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/ApplicationDetail'
import { myWorkCrumbs } from '@/app/(portal)/(staff)/my-work/crumbs'
import { SectionLabel } from '@/components/ui/section-label'
import { roundOf } from '@/app/(portal)/(staff)/cycles/[cycleId]/draft/components/snake'
import type {
  ApplicationSummary,
  DraftBoard,
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
import { useDraftRealtime } from '@/lib/realtime/useDraftRealtime'
import { LiveIndicator } from '@/components/LiveIndicator'

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
  const realtime = useDraftRealtime(cycleId)
  const { data: drafted = {} } = useDraftedApplications(cycleId, {
    poll: true,
  })
  const { data: groups = [], isLoading: groupsLoading } =
    usePreferenceListDetails(cycleId)
  const myGroup = groups.find((g) =>
    (g.members ?? []).some((m) => m.lead_nuid === user?.nuid)
  )
  const { data: boardsByRole, isPending } = useDraftBoards(cycleId, roleIds, {
    poll: true,
  })
  const boardsPending = roleIds.length > 0 && isPending
  const boards = roleIds.map((roleId): RoleBoard => ({
    roleId,
    board: boardsByRole?.[roleId],
  }))

  const [roleId, setRoleId] = useState('')

  if (cyclesLoading) {
    return (
      <div className={PAGE_SHELL}>
        <LoadingText />
      </div>
    )
  }

  const live = boards.filter((b) => isOpen(b.board))
  const current =
    boards.find((b) => b.roleId === roleId) ?? live[0] ?? boards[0]

  return (
    <div className={PAGE_SHELL}>
      <div className="flex flex-col gap-3">
        <PageHeader
          back={<Breadcrumbs items={CRUMBS} />}
          title={
            <span className="inline-flex items-center gap-3">
              Draft
              <LiveIndicator status={realtime} />
            </span>
          }
          actions={
            current &&
            boards.length > 1 && (
              <Select value={current.roleId} onValueChange={setRoleId}>
                <SelectTrigger className="w-56" aria-label="Position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((b) => (
                    <SelectItem key={b.roleId} value={b.roleId}>
                      {roleLabel(b.roleId)}
                      {!isOpen(b.board) && ' (not open)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }
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
        <div className="flex flex-col gap-6">
          <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-6">
              {isOpen(current.board) ? (
                <>
                  <OnTheClock
                    board={current.board}
                    groups={groups}
                    myGroup={myGroup}
                    drafted={drafted}
                  />
                  <TeamBoard board={current.board} myGroup={myGroup} />
                </>
              ) : (
                <EmptyState
                  title={`${roleLabel(current.roleId)} draft not open`}
                  description="It opens once a chief starts it."
                />
              )}
            </div>
            <ListSidebar
              key={current.roleId}
              cycleId={cycleId}
              roleIds={[current.roleId]}
              myGroup={myGroup}
              drafted={drafted}
              roleLabel={roleLabel}
            />
          </div>
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

function OnTheClock({
  board,
  groups,
  myGroup,
  drafted,
}: {
  board: DraftBoard
  groups: PreferenceListDetail[]
  myGroup?: PreferenceListDetail
  drafted: Record<string, string>
}) {
  const teams = board.teams ?? []
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const myTeam = teams.find((t) => t.preference_list_id === myGroup?.id)
  const onClock = teamById.get(board.on_the_clock_team_id ?? '')
  const complete = board.status === 'complete' || !board.on_the_clock
  const usUp = !complete && !!myTeam && myTeam.id === onClock?.id
  const total = board.rounds * teams.length
  const filled = new Set(board.picks.map((p) => p.pick_number))
  const upNext = (board.slots ?? []).find(
    (s) => s.pick_number > board.on_the_clock && !filled.has(s.pick_number)
  )
  const upNextTeam = upNext && teamById.get(upNext.draft_team_id)
  const nextFor = (listId?: string) =>
    ourEntries(
      groups.find((g) => g.id === listId),
      board.role_id
    ).find((e) => !drafted[e.application_id])
  const ourNext = nextFor(myGroup?.id)
  const theirNext = usUp ? undefined : nextFor(onClock?.preference_list_id)

  if (complete) {
    return (
      <div className="border border-gray-200 bg-white px-6 py-5">
        <p className="font-display text-ink text-lg font-bold tracking-wider uppercase">
          Draft complete
        </p>
        <p className="text-text-muted mt-1 text-sm">
          All {total} picks are in.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'border',
        usUp ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-white'
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-6 pt-5 pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span
            className={cn(
              'text-xs font-semibold tracking-wider uppercase',
              usUp ? 'text-white/70' : 'text-text-muted'
            )}
          >
            On the clock
          </span>
          <span className="font-display text-3xl font-bold wrap-anywhere">
            {usUp ? "You're up" : onClock?.name}
          </span>
        </div>
        <div className="flex gap-6">
          <Stat label="Round" inverse={usUp}>
            {roundOf(board.on_the_clock, teams.length)}
            <Of inverse={usUp}>/{board.rounds}</Of>
          </Stat>
          <Stat label="Pick" inverse={usUp}>
            {board.on_the_clock}
            <Of inverse={usUp}>/{total}</Of>
          </Stat>
        </div>
      </div>
      <div
        className={cn(
          'grid gap-x-6 gap-y-3 border-t px-6 py-4 sm:grid-cols-3',
          usUp ? 'border-white/15' : 'border-gray-100'
        )}
      >
        {theirNext && (
          <Stat label="Top of their list" inverse={usUp}>
            {theirNext.full_name}
          </Stat>
        )}
        {myTeam && (
          <Stat label="Top of our list" inverse={usUp}>
            {ourNext?.full_name ?? 'Nobody left'}
          </Stat>
        )}
        {upNextTeam && (
          <Stat label="Up next" inverse={usUp}>
            {upNextTeam.id === myTeam?.id ? 'Us' : upNextTeam.name}
          </Stat>
        )}
      </div>
      <div className={cn('h-1', usUp ? 'bg-white/15' : 'bg-gray-100')}>
        <div
          className={cn('h-full', usUp ? 'bg-white' : 'bg-ink')}
          style={{ width: `${(board.picks.length / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

function Of({
  inverse,
  children,
}: {
  inverse: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'font-normal',
        inverse ? 'text-white/50' : 'text-text-subtle'
      )}
    >
      {children}
    </span>
  )
}

function Stat({
  label,
  inverse,
  children,
}: {
  label: string
  inverse: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn('text-xs', inverse ? 'text-white/60' : 'text-text-muted')}
      >
        {label}
      </span>
      <span className="text-base font-semibold wrap-anywhere">{children}</span>
    </div>
  )
}

function TeamBoard({
  board,
  myGroup,
}: {
  board: DraftBoard
  myGroup?: PreferenceListDetail
}) {
  const teams = board.teams ?? []
  const picking = board.status === 'active' ? board.on_the_clock_team_id : ''

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Board</SectionLabel>
      <ul className="border border-gray-200 bg-white">
        {teams.map((team) => {
          const ours = team.preference_list_id === myGroup?.id
          const picks = board.picks
            .filter((p) => p.draft_team_id === team.id)
            .sort((a, b) => a.pick_number - b.pick_number)
          return (
            <li
              key={team.id}
              className={cn(
                'flex flex-col gap-2 px-4 py-3 not-first:border-t not-first:border-gray-100 sm:flex-row sm:items-baseline sm:gap-4',
                ours && 'bg-green-50/60'
              )}
            >
              <span className="text-ink flex shrink-0 items-center gap-2 text-sm font-semibold sm:w-36">
                <span className="min-w-0 break-words">{team.name}</span>
                {ours && (
                  <span className="font-display bg-ink px-1.5 py-0.5 text-[10px] tracking-wider text-white uppercase">
                    You
                  </span>
                )}
              </span>
              <ol className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {picks.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-baseline gap-1.5 border border-gray-200 bg-white px-2 py-1 text-sm"
                  >
                    <span className="text-text-subtle text-xs tabular-nums">
                      {p.pick_number}
                    </span>
                    <span className="text-ink">{p.full_name}</span>
                  </li>
                ))}
                {team.id === picking && (
                  <li className="border-ink text-ink border border-dashed px-2 py-1 text-sm font-semibold">
                    Picking…
                  </li>
                )}
                {picks.length === 0 && team.id !== picking && (
                  <li className="text-text-faint py-1 text-sm">No picks yet</li>
                )}
              </ol>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type SidebarTab = 'ours' | 'everyone'

function ListSidebar({
  cycleId,
  roleIds,
  myGroup,
  drafted,
  roleLabel,
}: {
  cycleId: string
  roleIds: string[]
  myGroup?: PreferenceListDetail
  drafted: Record<string, string>
  roleLabel: (id: string) => string
}) {
  const [tab, setTab] = useState<SidebarTab>(myGroup ? 'ours' : 'everyone')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [openApp, setOpenApp] = useState<ApplicationSummary | null>(null)
  const { data: pool = [], isLoading: poolLoading } = useApplications(
    { cycle_id: cycleId, stages: 'selection' },
    undefined,
    { enabled: !!cycleId }
  )
  const poolById = new Map(pool.map((a) => [a.id, a]))
  const ourRank = new Map<string, number>()
  for (const roleId of roleIds) {
    ourEntries(myGroup, roleId).forEach((e, i) =>
      ourRank.set(e.application_id, i + 1)
    )
  }
  const q = query.trim().toLowerCase()
  const matches = (name?: string | null) =>
    !q || (name || '').toLowerCase().includes(q)
  const visibleRoles = roleIds.filter((r) => !roleFilter || r === roleFilter)

  const available = pool
    .filter((a) => visibleRoles.includes(a.role_id))
    .filter((a) => matches(a.full_name))
    .sort(
      (a, b) =>
        (ourRank.get(a.id) ?? 999) - (ourRank.get(b.id) ?? 999) ||
        (a.full_name || '').localeCompare(b.full_name || '')
    )
  const oursLeft = roleIds.reduce(
    (n, r) =>
      n +
      ourEntries(myGroup, r).filter((e) => !drafted[e.application_id]).length,
    0
  )

  return (
    <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start">
      <SegmentedTabs<SidebarTab>
        className="self-start"
        value={tab}
        onChange={setTab}
        tabs={[
          ...(myGroup
            ? [{ id: 'ours' as const, label: 'Our list', count: oursLeft }]
            : []),
          {
            id: 'everyone',
            label: 'Everyone',
            count: pool.filter((a) => roleIds.includes(a.role_id)).length,
          },
        ]}
      />
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={tab === 'ours' ? 'Search our list' : 'Search applicants'}
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
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto max-lg:max-h-[32rem]">
        {tab === 'ours' ? (
          visibleRoles.map((roleId) => {
            const ours = ourEntries(myGroup, roleId)
            const next = ours.find((e) => !drafted[e.application_id])
            const shown = ours.filter((e) => matches(e.full_name))
            return (
              <div key={roleId} className="flex min-w-0 flex-col gap-2">
                {roleIds.length > 1 && (
                  <span className="font-display text-ink text-xs font-bold tracking-wider uppercase">
                    {roleLabel(roleId)}
                  </span>
                )}
                {shown.length === 0 ? (
                  <p className="text-text-faint border border-dashed border-gray-200 px-4 py-6 text-center text-sm">
                    {q ? 'Nobody matches that search.' : 'Nobody ranked'}
                  </p>
                ) : (
                  <ol className="border border-gray-200 bg-white">
                    {shown.map((e) => {
                      const by = drafted[e.application_id]
                      const isNext = e.application_id === next?.application_id
                      const app = poolById.get(e.application_id)
                      return (
                        <li
                          key={e.id}
                          className={cn(
                            'flex min-w-0 items-baseline gap-3 px-3 py-2 not-first:border-t not-first:border-gray-200',
                            isNext && 'bg-green-50'
                          )}
                        >
                          <span className="font-display text-ink w-5 shrink-0 text-right text-sm font-bold">
                            {ours.indexOf(e) + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <NameButton
                              onClick={app ? () => setOpenApp(app) : undefined}
                              className={
                                by
                                  ? 'text-text-subtle line-through'
                                  : 'text-ink font-semibold'
                              }
                            >
                              {e.full_name}
                            </NameButton>
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
          })
        ) : poolLoading ? (
          <LoadingText />
        ) : available.length === 0 ? (
          <p className="text-text-faint py-6 text-center text-sm">
            {q ? 'Nobody matches that search.' : 'Everyone has been drafted.'}
          </p>
        ) : (
          <ul className="border border-gray-200 bg-white">
            {available.map((a) => {
              const rank = ourRank.get(a.id)
              return (
                <li
                  key={a.id}
                  className="flex min-w-0 items-baseline gap-3 px-3 py-2 not-first:border-t not-first:border-gray-200"
                >
                  <span className="min-w-0 flex-1">
                    <NameButton
                      onClick={() => setOpenApp(a)}
                      className="text-ink"
                    >
                      {a.full_name || a.user_nuid}
                    </NameButton>
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
      </div>
      {openApp && (
        <ApplicationDetail
          applicant={toApplicantDetail(openApp)}
          onClose={() => setOpenApp(null)}
        />
      )}
    </aside>
  )
}

function NameButton({
  onClick,
  className,
  children,
}: {
  onClick?: () => void
  className?: string
  children: React.ReactNode
}) {
  if (!onClick) {
    return (
      <span className={cn('block text-sm wrap-anywhere', className)}>
        {children}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block text-left text-sm wrap-anywhere underline-offset-2 hover:underline',
        className
      )}
    >
      {children}
    </button>
  )
}
