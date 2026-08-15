import { notFound } from 'next/navigation'
import { PageContainer } from '@/components/PageContainer'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { InterviewScriptContent } from './components/InterviewScriptContent'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// No data of its own to fetch (the script is static content), but the route
// should still 401 the same as every other reviewer page rather than
// rendering to a signed-out visitor.
async function isSignedIn(): Promise<boolean> {
  try {
    await getCurrentUser(await getServerRequestOptions())
    return true
  } catch {
    return false
  }
}

export default async function InterviewScriptPage() {
  if (!(await isSignedIn())) notFound()

  return (
    <PageContainer>
      <div>
        <h1 className="text-text-default text-2xl font-semibold">
          Interview script
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          The intro speech, question bank, and challenge follow-ups to use while
          conducting an interview. Edit{' '}
          <code className="text-text-default rounded bg-gray-100 px-1 py-0.5 text-xs">
            src/lib/interview-script.ts
          </code>{' '}
          to change what shows up here.
        </p>
      </div>
      <div className="max-w-3xl">
        <InterviewScriptContent />
      </div>
    </PageContainer>
  )
}
