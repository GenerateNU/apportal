'use client'

import type { User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AuthContextValue = {
  user: User | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// initialUser comes from the server's read of the session cookie, so queries
// gated on the user can run during SSR rather than after a client effect.
export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null
  children: React.ReactNode
}) {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(initialUser)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [user, supabase]
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
