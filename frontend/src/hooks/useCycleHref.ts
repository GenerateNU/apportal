'use client'

import { useParams } from 'next/navigation'
import { cycleHref } from '@/lib/cycle-paths'

export function useCycleHref() {
  const { cycleId } = useParams<{ cycleId?: string }>()
  return (template: string) =>
    cycleId ? cycleHref(cycleId, template) : template
}
