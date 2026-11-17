import { PageContainer } from '@/components/PageContainer'
import { CandidatesPageClient } from './components/CandidatesPageClient'

export const dynamic = 'force-dynamic'

export default function CandidatesPage() {
  return (
    <PageContainer>
      <CandidatesPageClient />
    </PageContainer>
  )
}
