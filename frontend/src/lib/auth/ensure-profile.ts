import type { Session } from '@supabase/supabase-js'
import { upsertApplicant } from '@/generated/applicants/applicants'
import { getCurrentUser } from '@/generated/users/users'
import { APIError } from '@/lib/api/client'

type SignupMetadata = { nuid?: string; full_name?: string }

// Sign-up stashes the NUID and name on the Supabase account; the users row is
// created from them the first time the account has a verified session.
export async function ensureProfile(session: Session) {
  const meta = (session.user.user_metadata ?? {}) as SignupMetadata
  const email = session.user.email
  if (!meta.nuid || !email) return
  const opts = { headers: { Authorization: `Bearer ${session.access_token}` } }
  try {
    await getCurrentUser(opts)
    return
  } catch (err) {
    if (!(err instanceof APIError && err.status === 401)) throw err
  }
  await upsertApplicant(
    { nuid: meta.nuid, email, full_name: meta.full_name ?? '' },
    opts
  )
}
