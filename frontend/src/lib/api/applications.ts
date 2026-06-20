import { apiFetch, type FetchOptions } from './client'
import type { Application, ApplicationStage, Role } from './types'

export function getApplications(
  params?: { cycle_id?: string; stage?: ApplicationStage; role?: Role },
  opts?: FetchOptions,
): Promise<Application[]> {
  const query = new URLSearchParams()
  if (params?.cycle_id) query.set('cycle_id', params.cycle_id)
  if (params?.stage) query.set('stage', params.stage)
  if (params?.role) query.set('role', params.role)
  const qs = query.toString()
  return apiFetch(`/applications${qs ? `?${qs}` : ''}`, opts)
}

export function getApplication(id: string, opts?: FetchOptions): Promise<Application> {
  return apiFetch(`/applications/${id}`, opts)
}

export function createApplication(
  body: { applicant_nuid: string; cycle_id: string; role: Role },
  opts?: FetchOptions,
): Promise<Application> {
  return apiFetch('/applications', { ...opts, method: 'POST', body })
}

export function updateApplication(
  id: string,
  body: { stage?: ApplicationStage; interview_rating?: string; reviewer_notes?: string },
  opts?: FetchOptions,
): Promise<Application> {
  return apiFetch(`/applications/${id}`, { ...opts, method: 'PATCH', body })
}
