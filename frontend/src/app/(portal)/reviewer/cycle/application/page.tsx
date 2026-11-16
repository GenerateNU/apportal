import { requireChief } from '../components/ChiefPage'
import { ApplicationHubClient } from './components/ApplicationHubClient'

export const dynamic = 'force-dynamic'

export default async function ApplicationHubPage() {
  await requireChief()
  return <ApplicationHubClient />
}
