'use client'

import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'

type AuthContextValue = {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient())
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()
  // Only `users.me` is keyed by uid — every other query key (applicants,
  // reviews, preference lists, etc.) is identity-agnostic, since the backend
  // is what enforces per-viewer visibility. If a different person signs in
  // on the same tab after another signs out (both are soft navigations, no
  // page reload), those caches would otherwise keep serving the previous
  // person's data until each query's own staleTime happened to lapse.
  const currentUserId = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        currentUserId.current = data.session?.user.id ?? null
        setSession(data.session)
        setIsLoading(false)
      })
      .catch(() => {
        setSession(null)
        setIsLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null
      if (nextUserId !== currentUserId.current) {
        queryClient.clear()
      }
      currentUserId.current = nextUserId
      setSession(session)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase, queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, isLoading, supabase]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
