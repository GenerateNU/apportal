'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { User } from '@/lib/api/types'
import { useMembersInfinite } from '@/lib/queries/users'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { isMember } from '../lib/role-meta'
import { MemberRow } from './MemberRow'

const GRID_COLS = 'grid-cols-[1fr_140px_160px]'

const MEMBERS_PAGE_SIZE = 10

export function MembersClient() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMembersInfinite(MEMBERS_PAGE_SIZE, { actor: REVIEWER_ACTOR })
  const [search, setSearch] = useState('')

  const users = useMemo(
    () => (data?.pages.flatMap((page) => page?.users ?? []) ?? []) as User[],
    [data]
  )

  const members = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users
      .filter((u) => isMember(u.roles))
      .filter(
        (u) =>
          !query ||
          u.full_name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [users, search])

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

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-text-default text-2xl font-semibold">Members</h1>
        <p className="text-text-muted mt-1 text-sm">
          Manage which roles each team member holds.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="text-text-faint pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          className="focus:border-brand-blue focus:ring-brand-blue w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm outline-none focus:ring-1"
        />
      </div>

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            {search ? 'No members match your search' : 'No members yet'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div
            className={`text-text-subtle grid ${GRID_COLS} gap-4 border-b border-gray-100 px-4 py-3 text-xs font-medium tracking-wide uppercase`}
          >
            <span>User</span>
            <span>Joined</span>
            <span>Role</span>
          </div>
          <div className="divide-y divide-gray-100">
            {members.map((user) => (
              <MemberRow key={user.nuid} user={user} gridCols={GRID_COLS} />
            ))}
          </div>
          {hasNextPage && (
            <div ref={sentinelRef} className="p-3 text-center">
              <p className="text-text-faint text-xs">
                {isFetchingNextPage ? 'Loading more…' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
