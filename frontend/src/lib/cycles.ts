import type { Cycle } from '@/lib/api/types'

// Which cycle a page lands on before the user picks one. These live here
// rather than inline in each client because the server components prefetch
// the cycle-scoped application list — the prefetch only lands in the cache the
// client reads from if both sides derive the same cycle id.

// The Applications table: the cycle currently accepting applications, so
// reviewers land on the current cycle instead of every cycle ever run. Falls
// back to whichever cycle opened most recently if none is open (opens_at is
// only set on scheduled/draft cycles in practice).
export function defaultApplicationsCycleId(cycles: Cycle[]): string | null {
  const open = cycles.find((c) => c.status === 'open')
  if (open) return open.id
  let latest: { id: string; opens_at: string } | null = null
  for (const c of cycles) {
    if (c.opens_at && (!latest || c.opens_at > latest.opens_at)) {
      latest = { id: c.id, opens_at: c.opens_at }
    }
  }
  return latest?.id ?? null
}

// The chief-only pipeline pages (chief review, lead assignment, interview
// assignment), which scope every action to one cycle: the first open cycle,
// else the most recently created one (listCycles orders by created_at DESC).
export function defaultPipelineCycleId(cycles: Cycle[]): string | null {
  return (cycles.find((c) => c.status === 'open') ?? cycles[0])?.id ?? null
}
