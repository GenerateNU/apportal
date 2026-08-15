import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { InterviewScriptContent } from './components/InterviewScriptContent'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Any reviewer can view; only chiefs get the edit link. The backend is still
// the actual boundary (update-interview-script calls requireChief) — this
// just decides whether to show the link at all.
async function currentReviewer(): Promise<{ isChief: boolean } | null> {
  try {
    const user = await getCurrentUser(await getServerRequestOptions())
    return {
      isChief: (user.roles ?? []).some(
        (role) => role === 'chief' || role === 'admin'
      ),
    }
  } catch {
    return null
  }
}

export default async function InterviewScriptPage() {
  const reviewer = await currentReviewer()
  if (!reviewer) notFound()

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Interview script
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            The intro speech, question bank, and challenge follow-ups to use
            while conducting an interview.
          </p>
        </div>
        {reviewer.isChief && (
          <Link
            href="/reviewer/interview-script/edit"
            className="text-brand-blue inline-flex items-center gap-1 text-sm hover:underline"
          >
            <Pencil size={14} />
            Edit script
          </Link>
        )}
      </div>
      <div className="max-w-3xl">
        <InterviewScriptContent />
      </div>
    </PageContainer>
  )
}
