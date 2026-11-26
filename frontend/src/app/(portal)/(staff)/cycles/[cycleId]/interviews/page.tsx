import { requireChief } from '../components/ChiefPage'
import { InterviewingClient } from './components/InterviewingClient'

export const dynamic = 'force-dynamic'

export default async function InterviewingPage() {
  await requireChief()
  return <InterviewingClient />
}
