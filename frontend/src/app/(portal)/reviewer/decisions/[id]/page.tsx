import { notFound } from 'next/navigation'
import { getApplication } from '@/generated/applications/applications'
import type { Application, Role } from '@/lib/api/types'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { DecisionDraftClient } from './components/DecisionDraftClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// The cycle and role come from the application so the client can ask for the
// right letter and review questions. Everything else it needs (the decision
// row, the queue it sits in) comes from the cycle's decisions list, which the
// queue page has usually already cached.
export default async function DecisionDraftPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let application: Application
  try {
    application = (await getApplication(
      id,
      await getServerRequestOptions()
    )) as Application
  } catch {
    notFound()
  }

  return (
    <DecisionDraftClient
      applicationId={id}
      cycleId={application.cycle_id}
      role={application.role as Role}
    />
  )
}
