import { requireChief } from '../components/ChiefPage'
import { CutoffClient } from './components/CutoffClient'

export const dynamic = 'force-dynamic'

export default async function CutoffPage() {
  await requireChief()
  return <CutoffClient />
}
