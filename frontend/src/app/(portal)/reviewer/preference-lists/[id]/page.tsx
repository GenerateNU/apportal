import { notFound } from 'next/navigation'
import { PreferenceListDetailClient } from './components/PreferenceListDetailClient'
import { getServerCurrentUser } from '@/lib/auth/server-user'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

async function currentReviewer(): Promise<{ isChief: boolean } | null> {
  try {
    const user = await getServerCurrentUser()
    return {
      isChief: (user.roles ?? []).some(
        (role) => role === 'chief' || role === 'admin'
      ),
    }
  } catch {
    return null
  }
}

export default async function PreferenceListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const reviewer = await currentReviewer()
  if (!reviewer) notFound()

  return <PreferenceListDetailClient id={id} isChief={reviewer.isChief} />
}
