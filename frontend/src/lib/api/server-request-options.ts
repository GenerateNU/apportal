import { cache } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { RequestOptions } from './orval-mutator'

export const getServerSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
})

// For server-component prefetch calls, which share the process-wide
// AXIOS_INSTANCE across every request (see orval-mutator.ts) — so unlike the
// browser, identity can't be defaulted there and must be passed explicitly,
// per request, reading the caller's own session cookies.
export const getServerRequestOptions = cache(
  async (): Promise<RequestOptions> => {
    const session = await getServerSession()
    return session
      ? { headers: { Authorization: `Bearer ${session.access_token}` } }
      : {}
  }
)
