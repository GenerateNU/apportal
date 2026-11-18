'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { APIError } from '@/lib/api/client'

// Only data that had loaded and then went 403/404 counts: something never there
// (a draft board before it's opened) isn't a lost page. Opt out with meta.missingIsNormal.
export function AccessWatcher() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const toast = useToast()
  const pathname = usePathname()
  const leaving = useRef(false)

  useEffect(() => {
    leaving.current = false
  }, [pathname])

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated' || event.action.type !== 'error') return
        const { query } = event
        const err = event.action.error
        if (
          !(err instanceof APIError) ||
          (err.status !== 403 && err.status !== 404)
        )
          return
        if (query.state.data === undefined || query.meta?.missingIsNormal)
          return
        if (query.getObserversCount() === 0 || leaving.current) return
        leaving.current = true
        toast(
          err.status === 403
            ? 'You no longer have access to that page.'
            : 'That page was removed.',
          { variant: 'error' }
        )
        router.replace('/')
      }),
    [queryClient, router, toast]
  )

  return null
}
