import { requireChief } from '../components/ChiefPage'
import { TeamClient } from '../workflow/components/WorkflowClient'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  await requireChief()
  return <TeamClient />
}
