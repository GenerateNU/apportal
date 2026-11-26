import { requireChief } from '../../components/ChiefPage'
import { VoteQueueClient } from './VoteQueueClient'

export const dynamic = 'force-dynamic'

export default async function ChiefVotePage() {
  await requireChief()
  return <VoteQueueClient />
}
