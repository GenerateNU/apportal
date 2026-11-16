import { requireChief } from '../components/ChiefPage'
import { ReviewFormsClient } from './components/ReviewFormsClient'

export const dynamic = 'force-dynamic'

export default async function ReviewFormsPage() {
  await requireChief()
  return <ReviewFormsClient />
}
