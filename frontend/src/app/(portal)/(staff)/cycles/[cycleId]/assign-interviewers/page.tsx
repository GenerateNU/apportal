import { requireChief } from '../components/ChiefPage'
import { InterviewAssignClient } from './components/InterviewAssignClient'

export const dynamic = 'force-dynamic'

export default async function InterviewersPage() {
  await requireChief()
  return <InterviewAssignClient />
}
