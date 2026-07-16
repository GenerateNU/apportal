import type { CycleStatus } from '@/lib/api/types'

// Tag palette defined in globals.css (--color-chip-1..10-bg/-text). Colors
// are assigned by position, not by hashing a label — a hash can only pick
// from a fixed bucket count, and similarly-named labels (e.g. "Spring 2026"
// vs "Summer 2026") can hash into the same bucket even with many buckets.
// Assigning by the order a label first appears guarantees no two distinct
// labels collide until the set exceeds the palette size.
const CHIP_BADGE = [
  'bg-chip-1-bg text-chip-1-text',
  'bg-chip-2-bg text-chip-2-text',
  'bg-chip-3-bg text-chip-3-text',
  'bg-chip-4-bg text-chip-4-text',
  'bg-chip-5-bg text-chip-5-text',
  'bg-chip-6-bg text-chip-6-text',
  'bg-chip-7-bg text-chip-7-text',
  'bg-chip-8-bg text-chip-8-text',
  'bg-chip-9-bg text-chip-9-text',
  'bg-chip-10-bg text-chip-10-text',
]

export function paletteClass(index: number): string {
  return CHIP_BADGE[index % CHIP_BADGE.length]
}

export const cycleStatusDot: Record<CycleStatus, string> = {
  draft: 'bg-status-draft',
  open: 'bg-status-open',
  closed: 'bg-status-closed',
  archived: 'bg-status-archived',
}

export const cycleStatusLabel: Record<CycleStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived',
}
