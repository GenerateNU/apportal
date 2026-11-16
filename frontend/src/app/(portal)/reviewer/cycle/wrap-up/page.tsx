import { requireChief } from '../components/ChiefPage'
import { WrapUpClient } from './components/WrapUpClient'

export const dynamic = 'force-dynamic'

export default async function WrapUpPage() {
  await requireChief()
  return <WrapUpClient />
}
