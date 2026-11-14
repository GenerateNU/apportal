'use client'
import { PageContainer } from '@/components/PageContainer'

import { useEffect, useMemo, useRef, useState } from 'react'
import { UserPlus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { User, UserRole } from '@/lib/api/types'
import { useMembersInfinite } from '@/lib/queries/users'
import { isMember, STAFF_ROLES, USER_ROLE_LABEL } from '../lib/role-meta'
import { AddMemberDialog } from './AddMemberDialog'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { MemberRow } from './MemberRow'
import { ApplicantRow } from './ApplicantRow'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { TABLE_FRAME, TABLE_HEAD } from '@/components/ui/table-styles'
import { cn } from '@/lib/utils'

type RoleFilter = UserRole | 'all'
type ViewType = 'staff' | 'applicants'

// The Joined column is hidden below sm so rows fit a phone without scrolling.
const STAFF_GRID_COLS = 'grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_160px]'
const APPLICANTS_GRID_COLS =
  'grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_100px_140px_110px]'

const MEMBERS_PAGE_SIZE = 10

export function MembersClient() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMembersInfinite(MEMBERS_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [showAddMember, setShowAddMember] = useState(false)
  const [view, setView] = useState<ViewType>('staff')

  const users = useMemo(
    () => (data?.pages.flatMap((page) => page?.users ?? []) ?? []) as User[],
    [data]
  )

  const members = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = users.filter(
      (u) =>
        !query ||
        u.full_name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
    )

    if (view === 'staff') {
      return filtered
        .filter((u) => isMember(u.roles))
        .filter((u) => roleFilter === 'all' || u.roles.includes(roleFilter))
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
    } else {
      return filtered
        .filter((u) => u.roles.includes('applicant'))
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
    }
  }, [users, search, roleFilter, view])

  const isFiltered = search.trim() !== '' || roleFilter !== 'all'

  // Auto-loads the next page once the sentinel row scrolls into view —
  // classic infinite-scroll trigger, no extra dependency needed.
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const gridCols = view === 'staff' ? STAFF_GRID_COLS : APPLICANTS_GRID_COLS
  const headerLabel =
    view === 'staff'
      ? 'Manage which roles each team member holds.'
      : 'View applicant status and mark who has worked on a project before.'

  return (
    <PageContainer>
      <PageHeader
        title="Members"
        subtitle={headerLabel}
        actions={
          view === 'staff' && (
            <Button onClick={() => setShowAddMember(true)}>
              <UserPlus />
              Add user
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedTabs<ViewType>
          tabs={[
            { id: 'staff', label: 'Staff' },
            { id: 'applicants', label: 'Applicants' },
          ]}
          value={view}
          onChange={(id) => {
            setView(id)
            if (id === 'staff') setRoleFilter('all')
          }}
        />

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search members…"
          className="max-w-md min-w-48 flex-1"
        />

        {view === 'staff' && (
          <Select
            value={roleFilter}
            onValueChange={(val) => setRoleFilter(val as RoleFilter)}
          >
            <SelectTrigger className="w-40" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {STAFF_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {USER_ROLE_LABEL[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <AddMemberDialog open={showAddMember} onOpenChange={setShowAddMember} />

      {members.length === 0 && !hasNextPage ? (
        <EmptyState
          title={
            isFiltered
              ? 'No matches found'
              : view === 'staff'
                ? 'No staff members yet'
                : 'No applicants'
          }
        />
      ) : (
        <div className={TABLE_FRAME}>
          <div className="sm:min-w-120">
            <div className={cn('grid gap-4', gridCols, TABLE_HEAD)}>
              <span>User</span>
              <span className="hidden sm:block">Joined</span>
              <span>{view === 'staff' ? 'Role' : 'Status'}</span>
              {view === 'applicants' && <span>Returner</span>}
            </div>
            <div>
              {members.length === 0 ? (
                <EmptyState size="sm" title="Searching more results…" />
              ) : (
                members.map((user) =>
                  view === 'staff' ? (
                    <MemberRow
                      key={user.nuid}
                      user={user}
                      gridCols={gridCols}
                    />
                  ) : (
                    <ApplicantRow
                      key={user.nuid}
                      user={user}
                      gridCols={gridCols}
                    />
                  )
                )
              )}
            </div>
            {/* Rendered whenever more pages remain — even while the current
                filtered page is empty — so the observer keeps paging through
                batches that happen to contain no matches for this view/search
                instead of getting stuck once a page filters down to nothing. */}
            {hasNextPage && (
              <div ref={sentinelRef} className="p-3 text-center">
                <p className="text-text-faint text-xs">
                  {isFetchingNextPage ? 'Loading more…' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  )
}
