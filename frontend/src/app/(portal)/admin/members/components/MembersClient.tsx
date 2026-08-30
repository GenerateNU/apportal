'use client'
import { PageContainer } from '@/components/PageContainer'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
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
import { MemberRow } from './MemberRow'
import { ApplicantRow } from './ApplicantRow'

type RoleFilter = UserRole | 'all'
type ViewType = 'staff' | 'applicants'

const STAFF_GRID_COLS = 'grid-cols-[1fr_140px_160px]'
const APPLICANTS_GRID_COLS = 'grid-cols-[1fr_100px_140px_110px]'

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">Members</h1>
          <p className="text-text-muted mt-1 text-sm">{headerLabel}</p>
        </div>
        {view === 'staff' && (
          <Button onClick={() => setShowAddMember(true)}>
            <UserPlus />
            Add user
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => {
              setView('staff')
              setRoleFilter('all')
            }}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'staff'
                ? 'text-text-default bg-gray-100'
                : 'text-text-muted hover:text-text-default'
            }`}
          >
            Staff
          </button>
          <button
            onClick={() => setView('applicants')}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'applicants'
                ? 'text-text-default bg-gray-100'
                : 'text-text-muted hover:text-text-default'
            }`}
          >
            Applicants
          </button>
        </div>

        <div className="relative max-w-md flex-1">
          <Search className="text-text-faint pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            className="focus:border-brand-blue focus:ring-brand-blue w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm outline-none focus:ring-1"
          />
        </div>

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
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            {isFiltered
              ? 'No matches found'
              : view === 'staff'
                ? 'No staff members yet'
                : 'No applicants'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="min-w-120">
            <div
              className={`text-text-subtle grid ${gridCols} gap-4 border-b border-gray-100 px-4 py-3 text-xs font-medium tracking-wide uppercase`}
            >
              <span>User</span>
              <span>Joined</span>
              <span>{view === 'staff' ? 'Role' : 'Status'}</span>
              {view === 'applicants' && <span>Returner</span>}
            </div>
            <div className="divide-y divide-gray-100">
              {members.length === 0 ? (
                <p className="text-text-faint px-4 py-6 text-center text-sm">
                  Searching more results…
                </p>
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
