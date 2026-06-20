import { apiFetch, type FetchOptions } from './client'
import type { Cycle, CycleStatus } from './types'

export function getCycles(opts?: FetchOptions): Promise<Cycle[]> {
  return apiFetch('/cycles', opts)
}

export function getCycle(id: string, opts?: FetchOptions): Promise<Cycle> {
  return apiFetch(`/cycles/${id}`, opts)
}

export function createCycle(
  body: { name: string; status?: CycleStatus; opens_at?: string; closes_at?: string },
  opts?: FetchOptions,
): Promise<Cycle> {
  return apiFetch('/cycles', { ...opts, method: 'POST', body })
}

export function updateCycle(
  id: string,
  body: { name?: string; status?: CycleStatus; opens_at?: string; closes_at?: string },
  opts?: FetchOptions,
): Promise<Cycle> {
  return apiFetch(`/cycles/${id}`, { ...opts, method: 'PATCH', body })
}
