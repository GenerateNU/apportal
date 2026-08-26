import { PageContainer } from '@/components/PageContainer'
import { DraftClient } from './components/DraftClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default function DraftPage() {
  return (
    <PageContainer>
      <DraftClient />
    </PageContainer>
  )
}
