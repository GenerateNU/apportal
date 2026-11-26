'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries/keys'
import { createClient } from '@/lib/supabase/client'

export type RealtimeStatus = 'connecting' | 'live' | 'offline'

export function draftTopic(cycleId: string) {
  return `draft:${cycleId}`
}

export function useDraftRealtime(cycleId: string): RealtimeStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    if (!cycleId) return
    const supabase = createClient()
    const refresh = () => {
      if (queryClient.isMutating() > 0) return
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === queryKeys.drafts.all[0] &&
          q.queryKey[2] === cycleId,
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.workflow.detail(cycleId),
      })
    }
    const channel = supabase
      .channel(draftTopic(cycleId))
      .on('broadcast', { event: 'changed' }, refresh)
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setStatus('live')
          refresh()
        } else if (
          state === 'CHANNEL_ERROR' ||
          state === 'TIMED_OUT' ||
          state === 'CLOSED'
        ) {
          setStatus('offline')
        }
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [cycleId, queryClient])

  return cycleId ? status : 'connecting'
}
