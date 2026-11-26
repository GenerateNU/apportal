import { requireChief } from '../components/ChiefPage'
import { ReviewingClient } from './components/ReviewingClient'

export const dynamic = 'force-dynamic'

export default async function ReviewingPage() {
  await requireChief()
  return <ReviewingClient />
}
