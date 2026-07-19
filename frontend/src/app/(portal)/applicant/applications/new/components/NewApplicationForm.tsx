'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Role } from '@/lib/api/types'
import { useCreateApplication } from '@/lib/queries/applications'
import { usePutAnswers } from '@/lib/queries/answers'
import { useChallenges } from '@/lib/queries/challenges'
import { useQuestions } from '@/lib/queries/questions'
import { usePutSubmission } from '@/lib/queries/submissions'
import { useCurrentUser } from '@/lib/queries/users'
import { ROLE_LABEL } from '@/lib/roles'
import { ApplicationFields } from '../../components/ApplicationFields'
import type { AnswerValue } from '../../components/QuestionField'

export function NewApplicationForm({
  cycleId,
  cycleName,
  role,
}: {
  cycleId: string
  cycleName: string
  role: Role
}) {
  const router = useRouter()
  const { data: currentUser, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="text-text-muted flex items-center gap-2 px-8 py-10 text-sm">
        <Loader2 className="animate-spin" size={16} />
        Loading…
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <p className="text-text-muted text-sm">Sign in to apply.</p>
      </div>
    )
  }

  return (
    <Form
      cycleId={cycleId}
      cycleName={cycleName}
      role={role}
      userNuid={currentUser.nuid}
      onDone={(id) => router.push(`/applicant/applications/${id}`)}
    />
  )
}

function Form({
  cycleId,
  cycleName,
  role,
  userNuid,
  onDone,
}: {
  cycleId: string
  cycleName: string
  role: Role
  userNuid: string
  onDone: (applicationId: string) => void
}) {
  const actor = { nuid: userNuid, role: 'applicant' }
  const opts = { actor }

  const { data: questions = [] } = useQuestions(cycleId, role, opts)
  const { data: challenges = [] } = useChallenges(cycleId, role, opts)
  const challenge = challenges[0]

  const createApplication = useCreateApplication()
  const putAnswers = usePutAnswers()
  const putSubmission = usePutSubmission()

  const [values, setValues] = useState<Record<string, AnswerValue>>({})
  const [resumeUrl, setResumeUrl] = useState('')
  const [availability, setAvailability] = useState<Record<string, boolean>>({})
  const [submissionUrl, setSubmissionUrl] = useState('')
  const [error, setError] = useState(false)

  const submitting =
    createApplication.isPending ||
    putAnswers.isPending ||
    putSubmission.isPending

  const missingRequired = useMemo(
    () =>
      questions.some((q) => {
        if (!q.is_required) return false
        const v = values[q.id]
        if (q.question_type === 'checkbox') return !v?.options?.length
        return !v?.text?.trim()
      }),
    [questions, values]
  )

  async function handleSubmit() {
    setError(false)
    try {
      // Nothing is persisted until submit: create the application (with resume
      // and availability), then attach answers and the code submission.
      const app = await createApplication.mutateAsync({
        body: {
          cycle_id: cycleId,
          user_nuid: userNuid,
          role,
          resume_url: resumeUrl || undefined,
          availability,
        },
        opts,
      })
      if (!app?.id) throw new Error('missing application id')

      const answerItems = questions
        .map((q) => {
          const v = values[q.id]
          if (!v) return null
          if (q.question_type === 'checkbox') {
            if (!v.options?.length) return null
            return { question_id: q.id, answer_options: v.options }
          }
          if (!v.text?.trim()) return null
          return { question_id: q.id, answer_text: v.text }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)

      const tasks: Promise<unknown>[] = []
      if (answerItems.length > 0) {
        tasks.push(
          putAnswers.mutateAsync({
            applicationId: app.id,
            body: { answers: answerItems },
            opts,
          })
        )
      }
      if (challenge && submissionUrl.trim()) {
        tasks.push(
          putSubmission.mutateAsync({
            applicationId: app.id,
            body: {
              challenge_id: challenge.id,
              submission_url: submissionUrl.trim(),
            },
            opts,
          })
        )
      }
      await Promise.all(tasks)

      onDone(app.id)
    } catch {
      setError(true)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-10">
      <Link
        href="/applicant/applications"
        className="text-text-muted hover:text-text-default mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft size={14} />
        My Applications
      </Link>

      <header className="mb-8">
        <h1 className="text-text-default text-2xl font-semibold">
          {ROLE_LABEL[role]}
        </h1>
        <p className="text-text-muted mt-1 text-sm">{cycleName}</p>
      </header>

      <ApplicationFields
        questions={questions}
        challenge={challenge}
        values={values}
        onValueChange={(id, next) =>
          setValues((prev) => ({ ...prev, [id]: next }))
        }
        resumeUrl={resumeUrl}
        onResumeChange={setResumeUrl}
        availability={availability}
        onAvailabilityChange={setAvailability}
        submissionUrl={submissionUrl}
        onSubmissionChange={setSubmissionUrl}
      />

      <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-100 pt-6">
        {missingRequired && (
          <p className="text-text-faint mr-auto text-xs">
            Answer all required questions (*) before submitting.
          </p>
        )}
        {error && (
          <p className="text-destructive mr-auto text-xs">
            Something went wrong submitting your application. Please try again.
          </p>
        )}
        <Button onClick={handleSubmit} disabled={submitting || missingRequired}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Submitting…
            </>
          ) : (
            'Submit application'
          )}
        </Button>
      </div>
    </div>
  )
}
