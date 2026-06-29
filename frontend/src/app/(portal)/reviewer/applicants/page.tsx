import { getApplications } from '@/lib/api/applications'
import { getApplicant } from '@/lib/api/applicants'
import type { ApplicantApplication } from './components/types'
import { ApplicantsClient } from './components/ApplicantsClient'

// Stub actor until auth is wired up — matches seed reviewer 002199001 (chief)
const REVIEWER_ACTOR = { nuid: '002199001', role: 'chief' as const }

export default async function ApplicantsPage() {
  const applications = await getApplications(
    {},
    { actor: REVIEWER_ACTOR, cache: 'no-store' }
  )

  const uniqueNUIDs = [...new Set(applications.map((a) => a.user_nuid))]
  const applicantList = await Promise.all(
    uniqueNUIDs.map((nuid) => getApplicant(nuid))
  )
  const byNUID = Object.fromEntries(applicantList.map((a) => [a.nuid, a]))

  const rows: ApplicantApplication[] = applications.map((app) => {
    const person = byNUID[app.user_nuid]
    return {
      id: app.id,
      fullName: person?.full_name ?? app.user_nuid,
      nuid: app.user_nuid,
      email: person?.email ?? '',
      major: person?.major ?? null,
      graduationYear: person?.graduation_year ?? null,
      role: app.role,
      stage: app.stage,
      submittedAt: app.submitted_at,
    }
  })

  return <ApplicantsClient initialData={rows} />
}
