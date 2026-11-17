'use client'

import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { TABLE_FRAME, TABLE_HEAD } from '@/components/ui/table-styles'
import { useAdmins } from '@/lib/queries/users'
import { cn } from '@/lib/utils'
import { AddAdminDialog } from './AddAdminDialog'
import { CyclePicker, CycleTeams, useTeamCycles } from './CycleTeams'
import { AddStaffButton } from '../../branches/components/CycleStaff'
import { MemberRow } from './MemberRow'

type ViewType = 'admins' | 'teams'

// The Joined column is hidden below sm so rows fit a phone without scrolling.
const ADMIN_GRID_COLS = 'grid-cols-[1fr_88px] sm:grid-cols-[1fr_140px_88px]'

export function MembersClient() {
  const { data: admins = [], isLoading } = useAdmins()
  const [search, setSearch] = useState('')
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [view, setView] = useState<ViewType>('admins')
  const [pickedCycle, setPickedCycle] = useState('')
  const teams = useTeamCycles(pickedCycle)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return admins
      .filter(
        (u) =>
          !q ||
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [admins, search])

  return (
    <PageContainer>
      <PageHeader
        title="Members"
        subtitle={
          view === 'admins'
            ? 'Admins can see and manage every branch and cycle.'
            : 'Each cycle’s chiefs and leads. Pick a cycle to see or change its team.'
        }
        actions={
          view === 'admins' ? (
            <Button onClick={() => setShowAddAdmin(true)}>
              <UserPlus />
              Add admin
            </Button>
          ) : (
            teams.cycle && <AddStaffButton cycle={teams.cycle} />
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedTabs<ViewType>
          className="h-9 w-fit"
          tabs={[
            { id: 'admins', label: 'Admins' },
            { id: 'teams', label: 'Cycle teams' },
          ]}
          value={view}
          onChange={setView}
        />
        {view === 'teams' && teams.list.length > 0 && (
          <CyclePicker
            cycles={teams.list}
            value={teams.cycle?.id}
            onChange={setPickedCycle}
          />
        )}
        {view === 'admins' && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email…"
            className="max-w-md min-w-48 flex-1"
          />
        )}
      </div>

      {view === 'teams' ? (
        teams.isLoading ? (
          <LoadingText />
        ) : (
          <CycleTeams cycle={teams.cycle} />
        )
      ) : (
        <>
          {isLoading ? (
            <LoadingText />
          ) : shown.length === 0 ? (
            <EmptyState
              title={search.trim() ? 'No matches found' : 'No admins yet'}
            />
          ) : (
            <div className={TABLE_FRAME}>
              <div className="sm:min-w-120">
                <div className={cn('grid gap-4', ADMIN_GRID_COLS, TABLE_HEAD)}>
                  <span>User</span>
                  <span className="hidden sm:block">Joined</span>
                  <span />
                </div>
                {shown.map((user) => (
                  <MemberRow
                    key={user.nuid}
                    user={user}
                    gridCols={ADMIN_GRID_COLS}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AddAdminDialog open={showAddAdmin} onOpenChange={setShowAddAdmin} />
    </PageContainer>
  )
}
