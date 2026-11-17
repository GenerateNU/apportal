import { PageContainer } from '@/components/PageContainer'
import { LetterTemplatesClient } from './components/LetterTemplatesClient'

export const dynamic = 'force-dynamic'

export default function LetterTemplatesPage() {
  return (
    <PageContainer>
      <LetterTemplatesClient />
    </PageContainer>
  )
}
