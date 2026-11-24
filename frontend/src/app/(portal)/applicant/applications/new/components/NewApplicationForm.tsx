'use client'

import {
  SaveIndicator,
  type SaveIndicatorStatus,
} from '@/components/ui/save-indicator'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { HelpContact } from '@/components/HelpContact'
import { TemplateNote } from '../../components/TemplateNote'
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
import { APIError } from '@/lib/api/client'
import type {
  Application,
  CodeSubmission,
  User,
  WrittenAnswer,
} from '@/lib/api/types'
import { useApplicationTemplate } from '@/lib/queries/application-templates'
import {
  useApplications,
  useCreateApplication,
  useUpdateApplication,
} from '@/lib/queries/applications'
import { useAnswers, usePutAnswers } from '@/lib/queries/answers'
import { useChallenges } from '@/lib/queries/challenges'
import { useQuestions } from '@/lib/queries/questions'
import { usePutSubmission, useSubmission } from '@/lib/queries/submissions'
import { useCurrentUser } from '@/lib/queries/users'
import { useStore } from '@tanstack/react-form'
import { ApplicationFormFields } from './ApplicationFormFields'
import {
  useApplicationForm,
  type ApplicationFormValues,
} from './useApplicationForm'
import {
  answerError,
  challengeLinkError,
  isEmptyAnswer,
} from '../../lib/validation'
import type { AnswerValue } from '../../components/QuestionField'
import { PageHeader } from '@/components/ui/page-header'
import { PageSkeletonBody } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import {
  ApplicantPage,
  useCycleCrumb,
  useOriginCrumb,
} from '../../components/ApplicantPage'
import { QuestionOutline } from './QuestionOutline'
import { useRoleLookup } from '@/lib/queries/roles'

const DEFAULT_SUBMIT_ERROR =
  'Something went wrong submitting your application. Please try again.'

// Backend validation failures carry a human-readable `detail` (huma's
// RFC7807 error body, JSON-stringified onto APIError.message by
// orval-mutator) — surface it instead of the generic fallback so applicants
// see e.g. "all required questions must be answered" rather than having to
// guess and retry blindly.
function apiErrorDetail(err: unknown): string {
  if (!(err instanceof APIError)) return DEFAULT_SUBMIT_ERROR
  try {
    const body = JSON.parse(err.message) as { detail?: string }
    return body.detail || DEFAULT_SUBMIT_ERROR
  } catch {
    return DEFAULT_SUBMIT_ERROR
  }
}

function Loading() {
  return (
    <ApplicantPage>
      <div className="flex flex-col gap-8">
        <PageSkeletonBody />
      </div>
    </ApplicantPage>
  )
}

export function NewApplicationForm({
  cycleId,
  cycleName,
  role,
}: {
  cycleId: string
  cycleName: string
  role: string
}) {
  const router = useRouter()
  const { data: currentUser, isLoading } = useCurrentUser()

  if (isLoading) return <Loading />

  if (!currentUser) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8">
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
//
// This decision is made exactly once and then frozen. Form's own autosave
// creates the application on the first save, which invalidates this same
// "does an application exist" query — without freezing, that refetch would
// flip isDraft/loadingAnswers/loadingSubmission and unmount Form (destroying
// whatever the applicant had just typed) every time it saved for the first
// time.
function ResumeGate({
  cycleId,
  cycleName,
  role,
  currentUser,
  onDone,
}: {
  cycleId: string
  cycleName: string
  role: string
  currentUser: User
  onDone: (applicationId: string) => void
}) {
  const router = useRouter()
  const { data: existing = [], isLoading: loadingExisting } = useApplications({
    user_nuid: currentUser.nuid,
    cycle_id: cycleId,
    role_id: role,
  })
  const existingApp = existing[0]
  const isDraft = existingApp?.stage === 'draft'

  const { data: existingAnswers, isLoading: loadingAnswers } = useAnswers(
    isDraft ? existingApp.id : ''
  )
  const { data: existingSubmission, isLoading: loadingSubmission } =
    useSubmission(isDraft ? existingApp.id : '')

  const notReady =
    loadingExisting ||
    (!!existingApp && existingApp.stage !== 'draft') ||
    (isDraft && (loadingAnswers || loadingSubmission))

  // Freeze the initial resume decision the first time everything is ready,
  // computed during render (not in an effect) so it lands within the same
  // render pass — this codebase's established pattern for "sync from a
  // value that settles over a few renders" (see QuestionCard.tsx,
  // FormBuilderClient.tsx). It has to be frozen: once mounted, Form's own
  // autosave creates the application, which invalidates this same
  // useApplications query. Without freezing, that refetch would flip
  // isDraft/loadingAnswers/loadingSubmission back to "not ready" and unmount
  // Form, destroying whatever the applicant had just typed.
  const [initialData, setInitialData] = useState<{
    application: Application | null
    answers: WrittenAnswer[]
    submission: CodeSubmission | null
  } | null>(null)
  if (!initialData && !notReady) {
    setInitialData({
      application: isDraft ? existingApp : null,
      answers: isDraft ? (existingAnswers ?? []) : [],
      submission: isDraft ? (existingSubmission ?? null) : null,
    })
  }

  useEffect(() => {
    if (existingApp && existingApp.stage !== 'draft') {
      router.replace(`/applicant/applications/${existingApp.id}`)
    }
  }, [existingApp, router])

  if (!initialData) return <Loading />

  return (
    <Form
      cycleId={cycleId}
      cycleName={cycleName}
      role={role}
      onDone={onDone}
      initialApplication={initialData.application}
      initialAnswers={initialData.answers}
      initialSubmission={initialData.submission}
    />
  )
}

type SaveSnapshot = {
  values: Record<string, AnswerValue>
  resumeUrl: string
  availability: Record<string, boolean>
  submissionUrl: string
}

type SaveStatus = SaveIndicatorStatus

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
  role: string
  onDone: (applicationId: string) => void
  initialApplication: Application | null
  initialAnswers: WrittenAnswer[]
  initialSubmission: CodeSubmission | null
}) {
  const { roleLabel } = useRoleLookup()
  const cycleCrumb = useCycleCrumb(cycleId, cycleName)
  const origin = useOriginCrumb()
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: challenges = [] } = useChallenges(cycleId, role)
  const { data: template } = useApplicationTemplate(cycleId, role)
  const challenge = challenges[0]

  const createApplication = useCreateApplication()
  const updateApplication = useUpdateApplication()
  const putAnswers = usePutAnswers()
  const putSubmission = usePutSubmission()

  const router = useRouter()

  const [applicationId, setApplicationId] = useState(
    initialApplication?.id ?? null
  )
  const [initialFormValues] = useState<ApplicationFormValues>(() => {
    const map: Record<string, AnswerValue> = {}
    for (const a of initialAnswers) {
      if (a.answer_options?.length) {
        map[a.question_id] = { options: a.answer_options }
      } else if (a.answer_file_path) {
        map[a.question_id] = {
          filePath: a.answer_file_path,
          fileName: a.answer_file_name ?? undefined,
        }
      } else {
        map[a.question_id] = { text: a.answer_text ?? '' }
      }
    }
    return {
      answers: map,
      submissionUrl: initialSubmission?.submission_url ?? '',
    }
  })
  const form = useApplicationForm(initialFormValues)
  const formValues = useStore(form.store, (state) => state.values)
  const fieldMeta = useStore(form.store, (state) => state.fieldMeta) as Record<
    string,
    { isBlurred?: boolean; isDirty?: boolean } | undefined
  >
  const formDirty = useStore(form.store, (state) => state.isDirty)
  const values = formValues.answers
  const submissionUrl = formValues.submissionUrl
  const [resumeUrl] = useState(initialApplication?.resume_url ?? '')
  const [availability] = useState<Record<string, boolean>>(
    initialApplication?.availability ?? {}
  )
  const hasEdited = !!initialApplication || formDirty
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initialApplication ? 'saved' : 'idle'
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  // Set once the backend rejects a save/submit because the template's
  // deadline has passed — freezes the form instead of retrying autosave
  // against a request that will only ever 403 again.
  const [deadlineRejected, setDeadlineRejected] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [shownPage, setShownPage] = useState(0)
  const [furthestPage, setFurthestPage] = useState(0)
  const [pageDirection, setPageDirection] = useState<'forward' | 'back'>(
    'forward'
  )
  if (pageIndex !== shownPage) {
    setPageDirection(pageIndex > shownPage ? 'forward' : 'back')
    setShownPage(pageIndex)
  }
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null
  )

  // Deliberately NOT derived from comparing template.closes_at against the
  // browser's own clock — a device with the wrong time or timezone would
  // then block (or silently stop autosaving for) an applicant who is well
  // within the real deadline. The backend is the only trustworthy clock, so
  // this only flips once it actually rejects a save/submit with a 403.
  const deadlineClosed = deadlineRejected
  const pendingScrollRef = useRef<string | null>(null)
  const mobileOutlineRef = useRef<HTMLDetailsElement>(null)

  const pages = useMemo(() => groupQuestionsIntoPages(questions), [questions])
  const challengePage = challenge ? pages.length : -1
  const totalPages = pages.length + (challenge ? 1 : 0)
  const lastPage = Math.max(totalPages - 1, 0)

  const [resumed, setResumed] = useState(false)
  const [resumeScrollId, setResumeScrollId] = useState<string | null>(null)
  if (!resumed && pages.length > 0) {
    setResumed(true)
    let resumePage = -1
    let resumeId: string | null = null
    for (let p = 0; p < pages.length; p++) {
      for (const q of pages[p].questions) {
        const v = values[q.id]
        if (v?.text?.trim() || v?.options?.length || v?.filePath) {
          resumePage = p
          resumeId = q.id
        }
      }
    }
    if (resumeId) {
      setPageIndex(resumePage)
      setShownPage(resumePage)
      setFurthestPage(resumePage)
      setSelectedQuestionId(resumeId)
      setResumeScrollId(resumeId)
    }
  }

  useEffect(() => {
    if (!resumeScrollId) return
    document
      .getElementById(`question-${resumeScrollId}`)
      ?.scrollIntoView({ block: 'center' })
  }, [resumeScrollId])

  const currentPageQuestions = pages[pageIndex]?.questions ?? []
  const startIndex = pages
    .slice(0, pageIndex)
    .reduce((n, p) => n + p.questions.length, 0)

  // Refs so the debounce timer, unmount cleanup, and page-hide/back-button
  // handlers always act on the latest values without stale closures, and so
  // saves can be serialized (never more than one in flight at a time).
  const applicationIdRef = useRef(applicationId)
  const hasEditedRef = useRef(hasEdited)
  const deadlineClosedRef = useRef(deadlineClosed)
  const snapshotRef = useRef<SaveSnapshot>({
    values,
    resumeUrl,
    availability,
    submissionUrl,
  })
  const savingRef = useRef(false)
  const pendingRef = useRef(false)
  const pendingBackRef = useRef(false)
  const runSaveRef = useRef<(snapshot: SaveSnapshot) => Promise<void>>(
    async () => {}
  )

  useEffect(() => {
    applicationIdRef.current = applicationId
  }, [applicationId])
  useEffect(() => {
    hasEditedRef.current = hasEdited
  }, [hasEdited])
  useEffect(() => {
    deadlineClosedRef.current = deadlineClosed
  }, [deadlineClosed])

  async function runSave(snapshot: SaveSnapshot) {
    savingRef.current = true
    setSaveStatus('saving')
    try {
      let id = applicationIdRef.current
      if (!id) {
        const created = await createApplication.mutateAsync({
          body: {
            cycle_id: cycleId,
            role_id: role,
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
        if (q.question_type === 'url' && v?.filePath) {
          return {
            question_id: q.id,
            answer_text: '',
            answer_file_path: v.filePath,
            answer_file_name: v.fileName ?? '',
          }
        }
        return {
          question_id: q.id,
          answer_text: v?.text ?? '',
          answer_file_path: '',
          answer_file_name: '',
        }
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
    } catch (err) {
      setSaveStatus('error')
      if (err instanceof APIError && err.status === 403) {
        setDeadlineRejected(true)
        pendingRef.current = false
      }
      // Rethrown so handleSubmit (which awaits this directly, not via
      // scheduleSave) knows the save actually failed instead of silently
      // proceeding to submit against a DB state that's missing this edit —
      // that mismatch is what previously surfaced as a confusing "answer all
      // required questions" rejection even though every field looked filled.
      throw err
    } finally {
      savingRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        void runSaveRef.current(snapshotRef.current).catch(() => {})
      }
    }
  }

  // Refreshed after every render (not during render) so timers/handlers that
  // fire later always call the latest closure.
  useEffect(() => {
    runSaveRef.current = runSave
  })

  // Single gatekeeper for every save trigger (debounce timer, flush-on-close).
  // Re-checks savingRef at the moment it actually fires — not just when it
  // was scheduled — so a save that started after a timer was armed (e.g. a
  // submit-time runSave) can't be raced by that stale timer going off mid-
  // flight. If a save is already running, coalesce into the single pending
  // follow-up runSave's finally block already chains.
  function scheduleSave() {
    if (savingRef.current) {
      pendingRef.current = true
      return
    }
    // Failure is already reflected via saveStatus; nothing else here needs
    // to react to it, so swallow rather than leaving an unhandled rejection.
    void runSaveRef.current(snapshotRef.current).catch(() => {})
  }

  // Debounce ~1s after the last change, but never run two saves at once —
  // if edits land while a save is in flight, coalesce them into exactly one
  // follow-up save (handled in runSave's finally block above) instead of
  // firing overlapping requests that could resolve out of order.
  useEffect(() => {
    snapshotRef.current = { values, resumeUrl, availability, submissionUrl }
    if (!hasEdited || deadlineClosedRef.current) return

    const timer = setTimeout(scheduleSave, 1000)
    return () => clearTimeout(timer)
  }, [values, resumeUrl, availability, submissionUrl, hasEdited])

  // Best-effort flush on tab close/hide and on unmount — narrows the window
  // where the very last keystroke could be lost, in addition to the debounce.
  useEffect(() => {
    function flush() {
      if (hasEditedRef.current && !deadlineClosedRef.current) {
        scheduleSave()
      }
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
      router.push(origin.href)
    }
  }, [saveStatus, router, origin.href])

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
      router.push(origin.href)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [router, origin.href])

  function handleBack() {
    if (savingRef.current) {
      pendingBackRef.current = true
      return
    }
    router.push(origin.href)
  }

  // Waits out any autosave already in flight (including chained follow-ups
  // triggered from its own finally block) so a submit-time flush never races
  // a debounce-triggered save started moments earlier.
  async function waitForIdle() {
    while (savingRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  function errorFor(q: (typeof questions)[number]) {
    return answerError(q, values[q.id])
  }
  const challengeError = challenge
    ? challengeLinkError(submissionUrl)
    : undefined
  const blockedHere =
    pageIndex === lastPage
      ? questions.some((q) => !!errorFor(q)) || !!challengeError
      : currentPageQuestions.some((q) => !!errorFor(q))

  function revealed(p: number) {
    return p !== pageIndex ? p <= furthestPage : p < furthestPage
  }
  function engaged(name: string) {
    const meta = fieldMeta[name]
    return !!(meta?.isBlurred || meta?.isDirty)
  }
  const answeredIds = new Set(
    questions
      .filter((q) => !isEmptyAnswer(q, values[q.id]) && !errorFor(q))
      .map((q) => q.id)
  )
  if (challenge && submissionUrl.trim() && !challengeError) {
    answeredIds.add('challenge')
  }
  const problemIds = new Set<string>()
  pages.forEach((page, p) => {
    for (const q of page.questions) {
      if (
        errorFor(q) &&
        (revealed(p) ||
          engaged(`answers.${q.id}`) ||
          !isEmptyAnswer(q, values[q.id]))
      ) {
        problemIds.add(q.id)
      }
    }
  })
  if (challengeError && (revealed(challengePage) || engaged('submissionUrl'))) {
    problemIds.add('challenge')
  }

  const unlockedThrough =
    pages
      .slice(0, furthestPage + 1)
      .reduce((n, p) => n + p.questions.length, 0) -
    1 +
    (challenge && furthestPage >= challengePage ? 1 : 0)
  const activeQuestionId =
    selectedQuestionId ??
    currentPageQuestions[0]?.id ??
    (pageIndex === challengePage ? 'challenge' : null)

  function handleOutlineNavigate(targetPage: number, questionId: string) {
    if (targetPage > furthestPage) return
    setSelectedQuestionId(questionId)
    if (mobileOutlineRef.current) mobileOutlineRef.current.open = false
    if (targetPage === pageIndex) {
      const element = document.getElementById(`question-${questionId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    pendingScrollRef.current = questionId
    setPageIndex(targetPage)
  }

  function goToPage(next: number) {
    setPageIndex(next)
    setFurthestPage((f) => Math.max(f, next))
    setSelectedQuestionId(
      next === challengePage
        ? 'challenge'
        : (pages[next]?.questions[0]?.id ?? null)
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleNextPage() {
    goToPage(Math.min(lastPage, pageIndex + 1))
  }

  function handlePrevPage() {
    goToPage(Math.max(0, pageIndex - 1))
  }

  function handleFocusCapture(event: React.FocusEvent<HTMLDivElement>) {
    const block = (event.target as HTMLElement).closest('[id^="question-"]')
    if (block) setSelectedQuestionId(block.id.slice('question-'.length))
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
      // — wait out any autosave already running rather than racing it. A
      // second waitForIdle after runSave catches a chained follow-up save
      // that runSave's own finally block may have kicked off (unawaited) if
      // an edit landed while it was in flight.
      await waitForIdle()
      await runSave(snapshotRef.current)
      await waitForIdle()
      const id = applicationIdRef.current
      if (!id) throw new Error('missing application id')

      const app = await updateApplication.mutateAsync({
        id,
        body: { stage: 'submitted' },
      })
      onDone(app.id)
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        setDeadlineRejected(true)
        setSubmitError(
          'The application deadline has passed. This application can no longer be submitted.'
        )
      } else {
        setSubmitError(apiErrorDetail(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ApplicantPage>
      <header className="mb-6">
        <PageHeader
          back={
            <Breadcrumbs
              items={[
                { label: origin.label, onClick: handleBack },
                ...cycleCrumb,
                { label: roleLabel(role) },
              ]}
            />
          }
          title={roleLabel(role)}
          subtitle={cycleName}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <SaveIndicator status={saveStatus} />
            </div>
          }
        />
      </header>

      {deadlineClosed && (
        <p className="border-destructive/30 bg-destructive/5 text-destructive mb-6 border px-4 py-3 text-sm">
          The application deadline has passed. Your answers are saved, but this
          application can no longer be edited or submitted.
        </p>
      )}

      {template?.description && (
        <TemplateNote
          label="About this role"
          className="mb-8"
          expandable={false}
        >
          {template.description}
        </TemplateNote>
      )}

      {totalPages > 1 && (
        <details
          ref={mobileOutlineRef}
          className="group mb-6 border border-gray-200 bg-white lg:hidden"
        >
          <summary className="text-text-default flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Jump to a question
            <ChevronDown
              size={16}
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="max-h-[60dvh] overflow-y-auto border-t border-gray-100 px-1 py-3">
            <QuestionOutline
              pages={pages}
              selectedQuestionId={activeQuestionId}
              unlockedThrough={unlockedThrough}
              problemIds={problemIds}
              answeredIds={answeredIds}
              challengeName={challenge?.name}
              onNavigate={handleOutlineNavigate}
            />
          </div>
        </details>
      )}

      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto">
          <QuestionOutline
            pages={pages}
            selectedQuestionId={activeQuestionId}
            unlockedThrough={unlockedThrough}
            problemIds={problemIds}
            answeredIds={answeredIds}
            challengeName={challenge?.name}
            onNavigate={handleOutlineNavigate}
          />
        </aside>

        <div className="min-w-0" onFocusCapture={handleFocusCapture}>
          <div
            key={pageIndex}
            className={`animate-in fade-in duration-300 ease-out motion-reduce:animate-none ${pageDirection === 'forward' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'}`}
          >
            {pageIndex === challengePage ? (
              <h2 className="font-display text-ink mb-6 text-lg font-bold tracking-tight uppercase">
                Challenge
              </h2>
            ) : (
              pages[pageIndex]?.title && (
                <h2 className="font-display text-ink mb-6 text-lg font-bold tracking-tight uppercase">
                  {pages[pageIndex].title}
                </h2>
              )
            )}

            <ApplicationFormFields
              form={form}
              questions={currentPageQuestions}
              startIndex={startIndex}
              challenge={pageIndex === challengePage ? challenge : undefined}
              reveal={pageIndex < furthestPage}
              disabled={deadlineClosed}
              applicationId={applicationId ?? undefined}
            />

            {template?.instructions && pageIndex === lastPage && (
              <TemplateNote label="Before you submit" className="mt-8">
                {template.instructions}
              </TemplateNote>
            )}
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex-nowrap sm:px-0">
            {submitError && (
              <p className="text-destructive w-full text-xs sm:mr-auto sm:w-auto">
                {submitError}
              </p>
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
                disabled={blockedHere || deadlineClosed}
              >
                Next
                <ArrowRight size={14} />
              </Button>
            ) : (
              <Button
                onClick={() => setConfirmSubmit(true)}
                disabled={submitting || blockedHere || deadlineClosed}
              >
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

      <HelpContact className="mt-12 text-left" />

      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your application?</DialogTitle>
            <DialogDescription>
              Once you submit, you can&apos;t edit your answers. Make sure
              everything looks right before you send it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
              Keep editing
            </Button>
            <Button
              disabled={submitting}
              onClick={() => {
                setConfirmSubmit(false)
                void handleSubmit()
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ApplicantPage>
  )
}
