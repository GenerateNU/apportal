import { requireChief } from '../components/ChiefPage'
import { ReviewsClient } from './components/ReviewsClient'

export const dynamic = 'force-dynamic'

export default async function ReviewsPage() {
  await requireChief()
  return <ReviewsClient />
}
