import { PageContainer } from '@/components/PageContainer'
import { requireChief } from '@/lib/auth/guards'
import { LetterTemplatesClient } from './components/LetterTemplatesClient'

export const dynamic = 'force-dynamic'

export default async function LetterTemplatesPage() {
  await requireChief()
  return (
    <PageContainer>
      <LetterTemplatesClient />
    </PageContainer>
  )
}
