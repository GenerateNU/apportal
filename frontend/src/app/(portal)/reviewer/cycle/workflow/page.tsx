import { requireChief } from '../components/ChiefPage'
import { WorkflowClient } from './components/WorkflowClient'

export const dynamic = 'force-dynamic'

export default async function WorkflowPage() {
  await requireChief()
  return <WorkflowClient />
}
