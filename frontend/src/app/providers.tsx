'use client'

import {
  environmentManager,
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ToastProvider } from '@/components/ui/toast'
import { APIError } from '@/lib/api/client'
import { AuthProvider } from '@/lib/auth/auth-context'
import { createClient } from '@/lib/supabase/client'

// Ship the devtools only in development so they aren't bundled into production.
const showDevtools = process.env.NODE_ENV !== 'production'

// A stale client-side session (see /page.tsx's root-page handling for the
// full explanation) doesn't just break the root page — any query or mutation
// anywhere in the portal can 401 the same way, and without this, that failure
// was completely silent: no redirect, no message, just a page that quietly
// stops working. This is the one place every request in the app passes
// through, so it's the one place that can catch a 401 no matter which page
// or component triggered it.
let handlingAuthFailure = false

function handleQueryError(error: unknown) {
  if (typeof window === 'undefined') return
  if (!(error instanceof APIError) || error.status !== 401) return
  if (handlingAuthFailure) return
  if (
    window.location.pathname.startsWith('/login') ||
    window.location.pathname.startsWith('/signup')
  ) {
    return
  }

  handlingAuthFailure = true
  const redirectTo = window.location.pathname + window.location.search
  createClient()
    .auth.signOut()
    .finally(() => {
      window.location.href = `/login?sessionExpired=1&redirectTo=${encodeURIComponent(redirectTo)}`
    })
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Avoid an immediate refetch on the client right after SSR hands off
        staleTime: 30 * 1000,
      },
    },
    queryCache: new QueryCache({ onError: handleQueryError }),
    mutationCache: new MutationCache({ onError: handleQueryError }),
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (environmentManager.isServer()) {
    // Server: always make a new query client per request
    return makeQueryClient()
  }
  // Browser: reuse the same client across renders
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
        {showDevtools && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </AuthProvider>
  )
}
