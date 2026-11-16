import { getServerIsChief } from '@/lib/auth/server-user'
import { InterviewScriptOpeningClient } from '../components/InterviewScriptPageClient'

export const dynamic = 'force-dynamic'

export default async function InterviewScriptOpeningPage({
  params,
}: {
  params: Promise<{ roleId: string }>
}) {
  const { roleId } = await params
  const isChief = await getServerIsChief().catch(() => false)
  return <InterviewScriptOpeningClient roleId={roleId} isChief={isChief} />
}
