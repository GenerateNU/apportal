'use client'
import { PageContainer } from '@/components/PageContainer'

import { useEffect, useMemo, useRef, useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { User } from '@/lib/api/types'
import { useMembersInfinite } from '@/lib/queries/users'
import { isAdmin } from '../lib/role-meta'
import { AddAdminDialog } from './AddAdminDialog'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { MemberRow } from './MemberRow'
import { ApplicantRow } from './ApplicantRow'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { TABLE_FRAME, TABLE_HEAD } from '@/components/ui/table-styles'
import { cn } from '@/lib/utils'

type ViewType = 'admins' | 'applicants'

// The Joined column is hidden below sm so rows fit a phone without scrolling.
const ADMIN_GRID_COLS = 'grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_auto]'
const APPLICANTS_GRID_COLS =
  'grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_100px_140px_110px]'

const MEMBERS_PAGE_SIZE = 10

export function MembersClient() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMembersInfinite(MEMBERS_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [view, setView] = useState<ViewType>('admins')

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

    if (view === 'admins') {
      return filtered
        .filter((u) => isAdmin(u.roles))
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
    } else {
      return filtered
        .filter((u) => u.roles.includes('applicant'))
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
    }
  }, [users, search, view])

  const isFiltered = search.trim() !== ''

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

  const gridCols = view === 'admins' ? ADMIN_GRID_COLS : APPLICANTS_GRID_COLS
  const headerLabel =
    view === 'admins'
      ? 'Choose who is an admin. Leads and chiefs are set per cycle on the Branches page.'
      : 'View applicant status and mark who has worked on a project before.'

  return (
    <PageContainer>
      <PageHeader
        title="Members"
        subtitle={headerLabel}
        actions={
          view === 'admins' && (
            <Button onClick={() => setShowAddAdmin(true)}>
              <UserPlus />
              Add admin
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedTabs<ViewType>
          tabs={[
            { id: 'admins', label: 'Admins' },
            { id: 'applicants', label: 'Applicants' },
          ]}
          value={view}
          onChange={setView}
        />

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or email…"
          className="max-w-md min-w-48 flex-1"
        />
      </div>

      <AddAdminDialog open={showAddAdmin} onOpenChange={setShowAddAdmin} />

      {members.length === 0 && !hasNextPage ? (
        <EmptyState
          title={
            isFiltered
              ? 'No matches found'
              : view === 'admins'
                ? 'No admins yet'
                : 'No applicants'
          }
        />
      ) : (
        <div className={TABLE_FRAME}>
          <div className="sm:min-w-120">
            <div className={cn('grid gap-4', gridCols, TABLE_HEAD)}>
              <span>User</span>
              <span className="hidden sm:block">Joined</span>
              <span>{view === 'admins' ? '' : 'Status'}</span>
              {view === 'applicants' && <span>Returner</span>}
            </div>
            <div>
              {members.length === 0 ? (
                <EmptyState size="sm" title="Searching more results…" />
              ) : (
                members.map((user) =>
                  view === 'admins' ? (
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
