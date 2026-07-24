'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { HelpContact } from '@/components/HelpContact'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { groupQuestionsIntoPages } from '@/lib/applicationPages'
import type { Application, CodeSubmission, Role, User, WrittenAnswer } from '@/lib/api/types'
import { useApplicationTemplate } from '@/lib/queries/application-templates'
import {
  useApplications,
  useCreateApplication,
  useDeleteApplication,
  useUpdateApplication,
} from '@/lib/queries/applications'
import { useAnswers, usePutAnswers } from '@/lib/queries/answers'
import { useChallenges } from '@/lib/queries/challenges'
import { useQuestions } from '@/lib/queries/questions'
import { usePutSubmission, useSubmission } from '@/lib/queries/submissions'
import { useCurrentUser } from '@/lib/queries/users'
import { ROLE_LABEL } from '@/lib/roles'
import { ApplicationFields } from '../../components/ApplicationFields'
import type { AnswerValue } from '../../components/QuestionField'
import { QuestionOutline } from './QuestionOutline'

function Loading() {
  return (
    <div className="text-text-muted flex items-center gap-2 px-8 py-10 text-sm">
      <Loader2 className="animate-spin" size={16} />
      Loading…
    </div>
  )
}

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

  if (isLoading) return <Loading />

  if (!currentUser) {
    return (
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <p className="text-text-muted text-sm">Sign in to apply.</p>
      </div>
    )
  }

  return (
    <ResumeGate
      cycleId={cycleId}
      cycleName={cycleName}
      role={role}
      currentUser={currentUser}
      onDone={(id) => router.push(`/applicant/applications/${id}`)}
    />
  )
}

// Looks for an application this applicant already has for this cycle+role
// (the unique constraint guarantees at most one). A draft resumes into the
// form below; anything else means they've already submitted, so send them to
// the read-only view instead of letting them re-enter the create form.
function ResumeGate({
  cycleId,
  cycleName,
  role,
  currentUser,
  onDone,
}: {
  cycleId: string
  cycleName: string
  role: Role
  currentUser: User
  onDone: (applicationId: string) => void
}) {
  const router = useRouter()
  const { data: existing = [], isLoading: loadingExisting } = useApplications({
    user_nuid: currentUser.nuid,
    cycle_id: cycleId,
    role,
  })
  const existingApp = existing[0]
  const isDraft = existingApp?.stage === 'draft'

  const { data: existingAnswers, isLoading: loadingAnswers } = useAnswers(
    isDraft ? existingApp.id : ''
  )
  const { data: existingSubmission, isLoading: loadingSubmission } =
    useSubmission(isDraft ? existingApp.id : '')

  useEffect(() => {
    if (existingApp && existingApp.stage !== 'draft') {
      router.replace(`/applicant/applications/${existingApp.id}`)
    }
  }, [existingApp, router])

  if (loadingExisting) return <Loading />
  if (existingApp && existingApp.stage !== 'draft') return <Loading />
  if (isDraft && (loadingAnswers || loadingSubmission)) return <Loading />

  return (
    <Form
      cycleId={cycleId}
      cycleName={cycleName}
      role={role}
      onDone={onDone}
      initialApplication={isDraft ? existingApp : null}
      initialAnswers={isDraft ? (existingAnswers ?? []) : []}
      initialSubmission={isDraft ? (existingSubmission ?? null) : null}
    />
  )
}

type SaveSnapshot = {
  values: Record<string, AnswerValue>
  resumeUrl: string
  availability: Record<string, boolean>
  submissionUrl: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function Form({
  cycleId,
  cycleName,
  role,
  onDone,
  initialApplication,
  initialAnswers,
  initialSubmission,
}: {
  cycleId: string
  cycleName: string
  role: Role
  onDone: (applicationId: string) => void
  initialApplication: Application | null
  initialAnswers: WrittenAnswer[]
  initialSubmission: CodeSubmission | null
}) {
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: challenges = [] } = useChallenges(cycleId, role)
  const { data: template } = useApplicationTemplate(cycleId, role)
  const challenge = challenges[0]

  const createApplication = useCreateApplication()
  const updateApplication = useUpdateApplication()
  const deleteApplication = useDeleteApplication()
  const putAnswers = usePutAnswers()
  const putSubmission = usePutSubmission()

  const router = useRouter()

  const [applicationId, setApplicationId] = useState(initialApplication?.id ?? null)
  const [values, setValues] = useState<Record<string, AnswerValue>>(() => {
    const map: Record<string, AnswerValue> = {}
    for (const a of initialAnswers) {
      map[a.question_id] = a.answer_options?.length
        ? { options: a.answer_options }
        : { text: a.answer_text ?? '' }
    }
    return map
  })
  const [resumeUrl, setResumeUrl] = useState(initialApplication?.resume_url ?? '')
  const [availability, setAvailability] = useState<Record<string, boolean>>(
    initialApplication?.availability ?? {}
  )
  const [submissionUrl, setSubmissionUrl] = useState(
    initialSubmission?.submission_url ?? ''
  )
  const [hasEdited, setHasEdited] = useState(!!initialApplication)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initialApplication ? 'saved' : 'idle'
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const pendingScrollRef = useRef<string | null>(null)

  const pages = useMemo(() => groupQuestionsIntoPages(questions), [questions])
  const lastPage = Math.max(pages.length - 1, 0)
  const currentPageQuestions = pages[pageIndex]?.questions ?? []
  const startIndex = pages
    .slice(0, pageIndex)
    .reduce((n, p) => n + p.questions.length, 0)

  // Refs so the debounce timer, unmount cleanup, and page-hide/back-button
  // handlers always act on the latest values without stale closures, and so
  // saves can be serialized (never more than one in flight at a time).
  const applicationIdRef = useRef(applicationId)
  const hasEditedRef = useRef(hasEdited)
  const snapshotRef = useRef<SaveSnapshot>({
    values,
    resumeUrl,
    availability,
    submissionUrl,
  })
  const savingRef = useRef(false)
  const pendingRef = useRef(false)
  const pendingBackRef = useRef(false)
  const runSaveRef = useRef<(snapshot: SaveSnapshot) => Promise<void>>(async () => {})

  useEffect(() => {
    applicationIdRef.current = applicationId
  }, [applicationId])
  useEffect(() => {
    hasEditedRef.current = hasEdited
  }, [hasEdited])

  async function runSave(snapshot: SaveSnapshot) {
    savingRef.current = true
    setSaveStatus('saving')
    try {
      let id = applicationIdRef.current
      if (!id) {
        const created = await createApplication.mutateAsync({
          body: {
            cycle_id: cycleId,
            role,
            resume_url: snapshot.resumeUrl || undefined,
            availability: snapshot.availability,
          },
        })
        if (!created?.id) throw new Error('missing application id')
        id = created.id
        applicationIdRef.current = id
        setApplicationId(id)
      } else {
        await updateApplication.mutateAsync({
          id,
          body: {
            resume_url: snapshot.resumeUrl || undefined,
            availability: snapshot.availability,
          },
        })
      }

      // Always send every question (not just the non-empty ones) — a field
      // that was cleared after an earlier autosave needs to actually clear
      // the stored answer, not leave the stale value in place.
      const answerItems = questions.map((q) => {
        const v = snapshot.values[q.id]
        if (q.question_type === 'checkbox') {
          return { question_id: q.id, answer_options: v?.options ?? [] }
        }
        return { question_id: q.id, answer_text: v?.text ?? '' }
      })
      await putAnswers.mutateAsync({
        applicationId: id,
        body: { answers: answerItems },
      })

      if (challenge && snapshot.submissionUrl.trim()) {
        await putSubmission.mutateAsync({
          applicationId: id,
          body: {
            challenge_id: challenge.id,
            submission_url: snapshot.submissionUrl.trim(),
          },
        })
      }
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    } finally {
      savingRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        void runSaveRef.current(snapshotRef.current)
      }
    }
  }

  // Refreshed after every render (not during render) so timers/handlers that
  // fire later always call the latest closure.
  useEffect(() => {
    runSaveRef.current = runSave
  })

  // Debounce ~1s after the last change, but never run two saves at once —
  // if edits land while a save is in flight, coalesce them into exactly one
  // follow-up save (handled in runSave's finally block above) instead of
  // firing overlapping requests that could resolve out of order.
  useEffect(() => {
    snapshotRef.current = { values, resumeUrl, availability, submissionUrl }
    if (!hasEdited) return

    if (savingRef.current) {
      pendingRef.current = true
      return
    }
    const timer = setTimeout(() => {
      void runSaveRef.current(snapshotRef.current)
    }, 1000)
    return () => clearTimeout(timer)
  }, [values, resumeUrl, availability, submissionUrl, hasEdited])

  // Best-effort flush on tab close/hide and on unmount — narrows the window
  // where the very last keystroke could be lost, in addition to the debounce.
  useEffect(() => {
    function flush() {
      if (hasEditedRef.current) void runSaveRef.current(snapshotRef.current)
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      flush()
    }
  }, [])

  // Warn on a full-page unload only while a save hasn't landed yet.
  useEffect(() => {
    if (saveStatus !== 'saving') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveStatus])

  // Once a save that was in flight when the user tried to leave finishes,
  // actually navigate away.
  useEffect(() => {
    if (pendingBackRef.current && saveStatus !== 'saving') {
      pendingBackRef.current = false
      router.push('/applicant/applications')
    }
  }, [saveStatus, router])

  // Intercept the browser Back button (App Router has no route-change guard)
  // only long enough to make sure an in-flight save finishes first — content
  // is autosaved, so there's nothing to confirm/discard, just a brief wait.
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    const onPopState = () => {
      if (savingRef.current) {
        window.history.pushState(null, '', window.location.href)
        pendingBackRef.current = true
        return
      }
      router.push('/applicant/applications')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [router])

  function handleBack() {
    if (savingRef.current) {
      pendingBackRef.current = true
      return
    }
    router.push('/applicant/applications')
  }

  function updateValue(id: string, next: AnswerValue) {
    setHasEdited(true)
    setValues((prev) => ({ ...prev, [id]: next }))
  }
  function updateResumeUrl(next: string) {
    setHasEdited(true)
    setResumeUrl(next)
  }
  function updateAvailability(next: Record<string, boolean>) {
    setHasEdited(true)
    setAvailability(next)
  }
  function updateSubmissionUrl(next: string) {
    setHasEdited(true)
    setSubmissionUrl(next)
  }

  async function handleDiscard() {
    if (applicationId) {
      await deleteApplication.mutateAsync({ id: applicationId })
    }
    setApplicationId(null)
    setValues({})
    setResumeUrl('')
    setAvailability({})
    setSubmissionUrl('')
    setHasEdited(false)
    setSaveStatus('idle')
    setSubmitError(null)
    setPageIndex(0)
    setConfirmDiscard(false)
  }

  // Waits out any autosave already in flight (including chained follow-ups
  // triggered from its own finally block) so a submit-time flush never races
  // a debounce-triggered save started moments earlier.
  async function waitForIdle() {
    while (savingRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  function isMissing(q: (typeof questions)[number]) {
    if (!q.is_required) return false
    const v = values[q.id]
    if (q.question_type === 'checkbox') return !v?.options?.length
    return !v?.text?.trim()
  }

  // Full-form check gates the final submit; the current page's own check
  // gates "Next" so issues surface page-by-page rather than all at once.
  const missingRequired = useMemo(
    () => questions.some(isMissing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, values]
  )
  const currentPageMissingRequired = useMemo(
    () => currentPageQuestions.some(isMissing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPageQuestions, values]
  )

  function handleOutlineNavigate(targetPage: number, questionId: string) {
    if (targetPage === pageIndex) {
      document
        .getElementById(`question-${questionId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    pendingScrollRef.current = questionId
    setPageIndex(targetPage)
  }

  function handleNextPage() {
    setPageIndex((i) => Math.min(lastPage, i + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePrevPage() {
    setPageIndex((i) => Math.max(0, i - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Scroll to a question the outline linked to only after the page it lives
  // on has actually rendered.
  useEffect(() => {
    const id = pendingScrollRef.current
    if (!id) return
    pendingScrollRef.current = null
    document
      .getElementById(`question-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [pageIndex])

  async function handleSubmit() {
    setSubmitError(null)
    setSubmitting(true)
    try {
      // Make sure the latest edits are actually persisted before submitting
      // — wait out any autosave already running rather than racing it.
      await waitForIdle()
      await runSave(snapshotRef.current)
      const id = applicationIdRef.current
      if (!id) throw new Error('missing application id')

      const app = await updateApplication.mutateAsync({
        id,
        body: { stage: 'submitted' },
      })
      onDone(app.id)
    } catch {
      setSubmitError(
        'Something went wrong submitting your application. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      <button
        type="button"
        onClick={handleBack}
        className="text-text-muted hover:text-text-default mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft size={14} />
        My Applications
      </button>

      <header className="mb-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-text-default text-2xl font-semibold">
            {ROLE_LABEL[role]}
          </h1>
          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && (
              <span className="text-text-subtle text-xs">Saving…</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-text-subtle text-xs">All changes saved</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-destructive text-xs">Couldn&apos;t save</span>
            )}
            {applicationId && (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className="text-text-subtle hover:text-text-default text-xs underline underline-offset-2"
              >
                Discard and start over
              </button>
            )}
          </div>
        </div>
        <p className="text-text-muted mt-1 text-sm">{cycleName}</p>
        <HelpContact className="mt-3 text-left" />
      </header>

      {template?.description && pageIndex === 0 && (
        <MarkdownContent className="text-text-muted mb-8 text-sm leading-relaxed">
          {template.description}
        </MarkdownContent>
      )}

      {pages.length > 1 && (
        <p className="text-text-subtle mb-4 text-xs">
          Page {pageIndex + 1} of {pages.length}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:sticky lg:top-10 lg:block">
          <QuestionOutline
            pages={pages}
            currentPageIndex={pageIndex}
            onNavigate={handleOutlineNavigate}
          />
        </aside>

        <div className="min-w-0">
          {pages[pageIndex]?.title && (
            <h2 className="text-text-default mb-4 text-lg font-semibold">
              {pages[pageIndex].title}
            </h2>
          )}

          <ApplicationFields
            questions={currentPageQuestions}
            startIndex={startIndex}
            challenge={pageIndex === lastPage ? challenge : undefined}
            values={values}
            onValueChange={updateValue}
            resumeUrl={resumeUrl}
            onResumeChange={updateResumeUrl}
            availability={availability}
            onAvailabilityChange={updateAvailability}
            submissionUrl={submissionUrl}
            onSubmissionChange={updateSubmissionUrl}
          />

          {template?.instructions && pageIndex === lastPage && (
            <MarkdownContent className="text-text-muted mt-8 text-sm leading-relaxed">
              {template.instructions}
            </MarkdownContent>
          )}

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-100 pt-6">
            {pageIndex === lastPage
              ? missingRequired && (
                  <p className="text-text-muted mr-auto text-xs">
                    Answer all required questions (*) before submitting.
                  </p>
                )
              : currentPageMissingRequired && (
                  <p className="text-text-muted mr-auto text-xs">
                    Answer all required questions (*) on this page before
                    continuing.
                  </p>
                )}
            {submitError && (
              <p className="text-destructive mr-auto text-xs">{submitError}</p>
            )}
            {pageIndex > 0 && (
              <Button variant="outline" onClick={handlePrevPage}>
                <ArrowLeft size={14} />
                Back
              </Button>
            )}
            {pageIndex < lastPage ? (
              <Button
                onClick={handleNextPage}
                disabled={currentPageMissingRequired}
              >
                Next
                <ArrowRight size={14} />
              </Button>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              This will permanently delete everything you&apos;ve entered so
              far and start you over with a blank form.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
