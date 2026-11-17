import { PageContainer } from '@/components/PageContainer'
import { requireChief } from '@/lib/auth/guards'
import { CandidatesPageClient } from './components/CandidatesPageClient'

export const dynamic = 'force-dynamic'

export default async function CandidatesPage() {
  await requireChief()
  return (
    <PageContainer>
      <CandidatesPageClient />
    </PageContainer>
  )
}
