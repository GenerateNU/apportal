import { cache } from 'react'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { User } from '@/lib/api/types'

// Per-request memo: the portal layout and most pages both need /users/me, and
// this keeps that to one backend call per render.
export const getServerCurrentUser = cache(
  async () => (await getCurrentUser(await getServerRequestOptions())) as User
)
