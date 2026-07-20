'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import type { User } from '@/lib/api/types'
import { getPrimaryRole, USER_ROLE_LABEL } from '../lib/role-meta'
import { RoleEditDialog } from './RoleEditDialog'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function MemberRow({
  user,
  gridCols,
}: {
  user: User
  gridCols: string
}) {
  const [showEdit, setShowEdit] = useState(false)
  const primaryRole = getPrimaryRole(user.roles)
  const extraRoleCount = user.roles.filter(
    (r) => r !== 'applicant' && r !== primaryRole
  ).length

  return (
    <div className={`grid ${gridCols} items-center gap-4 px-4 py-3`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={user.full_name} size="sm" />
        <div className="min-w-0">
          <p className="text-text-default truncate text-sm font-semibold">
            {user.full_name}
          </p>
          <p className="text-text-subtle truncate text-xs">{user.email}</p>
        </div>
      </div>

      <span className="text-text-secondary text-sm">
        {formatDate(user.created_at)}
      </span>

      <button
        type="button"
        onClick={() => setShowEdit(true)}
        aria-label="Edit roles"
        className="text-text-secondary flex w-fit items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm hover:border-gray-300 hover:bg-gray-50"
      >
        {USER_ROLE_LABEL[primaryRole]}
        {extraRoleCount > 0 && (
          <span className="text-text-faint text-xs">+{extraRoleCount}</span>
        )}
        <ChevronDown className="text-text-faint h-3.5 w-3.5" />
      </button>

      <RoleEditDialog open={showEdit} onOpenChange={setShowEdit} user={user} />
    </div>
  )
}
