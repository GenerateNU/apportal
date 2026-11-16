'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CornerDownRight,
  Mic,
  Pencil,
  Plus,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { useToast } from '@/components/ui/toast'
import { useCycleScope } from '@/hooks/useCycleScope'
import { apiErrorDetail } from '@/lib/api/client'
import type {
  InterviewScript,
  InterviewScriptChallengeTrack,
  InterviewScriptQuestion,
} from '@/lib/api/types'
import {
  useInterviewScript,
  useUpdateInterviewScript,
} from '@/lib/queries/interview-script'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { useCycleTemplateSummary } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { useQueryClient } from '@tanstack/react-query'

type Status = 'saved' | 'saving' | 'unsaved'
type SectionId = 'opening' | 'questions' | 'challenge' | 'closing' | 'after'

const INLINE =
  'field-sizing-content -mx-2 w-[calc(100%+1rem)] resize-none border border-transparent bg-transparent px-2 py-1.5 outline-none transition-colors placeholder:text-text-faint hover:border-gray-200 focus:border-gray-300'

export function InterviewScriptPageClient() {
  const scope = useCycleScope()
  const { data: summaries = [] } = useCycleTemplateSummary(scope.cycleId)
  const router = useRouter()

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Interview script"
        subtitle="What interviewers say and ask, one script per opening. Every interviewer sees it during their interviews."
      />
      {!scope.cycleId ? (
        scope.isLoading ? (
          <LoadingText />
        ) : (
          <EmptyState title="You're not on any cycle yet" />
        )
      ) : scope.roles.roleIds.length === 0 ? (
        <EmptyState title="Add an opening first" />
      ) : (
        <Card padding="none">
          {scope.roles.roleIds.map((id) => {
            const s = summaries.find((x) => x.role_id === id)
            const href = `/reviewer/interview-script/${id}`
            return (
              <div
                key={id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') router.push(href)
                }}
                className="group flex cursor-pointer items-center gap-4 border-b border-gray-100 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-ink truncate font-semibold">
                    {scope.roles.roleLabel(id)}
                  </div>
                  <div className="text-text-muted flex items-center gap-1.5 text-xs">
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        s?.script_written ? 'bg-emerald-500' : 'bg-amber-400'
                      )}
                    />
                    {s?.script_written ? 'Written' : 'Not written'}
                    {!!s?.script_questions &&
                      ` · ${s.script_questions} question${s.script_questions === 1 ? '' : 's'}`}
                  </div>
                </div>
                <ArrowRight
                  size={16}
                  className="text-text-subtle group-hover:text-ink shrink-0 transition-transform group-hover:translate-x-0.5"
                />
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

export function InterviewScriptOpeningClient({
  roleId,
  isChief,
}: {
  roleId: string
  isChief: boolean
}) {
  const scope = useCycleScope()
  const [status, setStatus] = useState<Status>('saved')
  const name = scope.roles.roleLabel(roleId)

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        back={
          <Breadcrumbs
            items={[
              { label: 'Interview script', href: '/reviewer/interview-script' },
              { label: name },
            ]}
          />
        }
        title={name}
        subtitle="Every interviewer for this opening sees this script during their interviews."
        actions={
          status !== 'saved' && (
            <span className="text-text-subtle text-xs">Saving…</span>
          )
        }
      />
      {!scope.cycleId ? (
        <LoadingText />
      ) : (
        <Script
          key={`${scope.cycleId}:${roleId}`}
          cycleId={scope.cycleId}
          roleId={roleId}
          canEdit={isChief}
          onStatus={setStatus}
        />
      )}
    </div>
  )
}

function bodyOf(f: InterviewScript) {
  return {
    intro_speech: f.intro_speech,
    recording_reminder: f.recording_reminder,
    questions: f.questions,
    closing_note: f.closing_note,
    challenge_intro: f.challenge_intro,
    challenge_tracks: f.challenge_tracks,
    post_interview_checklist: f.post_interview_checklist,
  }
}

function Script({
  cycleId,
  roleId,
  canEdit,
  onStatus,
}: {
  cycleId: string
  roleId: string
  canEdit: boolean
  onStatus: (s: Status) => void
}) {
  const { data: script, isLoading } = useInterviewScript(cycleId, roleId)
  const { mutate } = useUpdateInterviewScript()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<InterviewScript | null>(null)
  const [savedBody, setSavedBody] = useState('')
  const [editing, setEditing] = useState<SectionId | null>(null)

  if (!form && script) {
    setForm(script)
    setSavedBody(JSON.stringify(bodyOf(script)))
  }

  const pending = form ? JSON.stringify(bodyOf(form)) : ''
  const dirty = !!form && pending !== savedBody

  useEffect(() => {
    onStatus(dirty ? 'saving' : 'saved')
    if (!dirty || !form) return
    const t = setTimeout(
      () =>
        mutate(
          { cycleId, roleId, body: bodyOf(form) },
          {
            onSuccess: () => {
              setSavedBody(pending)
              onStatus('saved')
              queryClient.invalidateQueries({
                queryKey: queryKeys.cycles.templateSummary(cycleId),
              })
            },
            onError: (err) => {
              onStatus('unsaved')
              toast(apiErrorDetail(err), { variant: 'error' })
            },
          }
        ),
      800
    )
    return () => clearTimeout(t)
  }, [
    pending,
    dirty,
    form,
    cycleId,
    roleId,
    mutate,
    onStatus,
    toast,
    queryClient,
  ])

  if (isLoading || !form) return <LoadingText label="Loading script…" />

  function set<K extends keyof InterviewScript>(
    key: K,
    value: InterviewScript[K]
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const questions = form.questions
  function setQuestion(i: number, next: InterviewScriptQuestion) {
    set(
      'questions',
      questions.map((q, idx) => (idx === i ? next : q))
    )
  }
  function move(i: number, by: number) {
    const next = [...questions]
    const [q] = next.splice(i, 1)
    next.splice(i + by, 0, q)
    set('questions', next)
  }
  const section = (id: SectionId) => ({
    editing: editing === id,
    onToggle: canEdit
      ? () => setEditing(editing === id ? null : id)
      : undefined,
  })
  const tracks = (['backend', 'frontend'] as const).map((key) => ({
    key,
    track: form.challenge_tracks[key],
  }))

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <Section
        title="Opening"
        {...section('opening')}
        view={
          <>
            <Clamped text={form.intro_speech} lines={3} />
            {form.recording_reminder && (
              <p className="text-text-muted flex items-center gap-1.5 text-xs">
                <Mic size={12} /> {form.recording_reminder}
              </p>
            )}
          </>
        }
      >
        <textarea
          aria-label="Opening speech"
          autoFocus
          className={cn(
            INLINE,
            'text-text-default min-h-32 text-sm leading-relaxed'
          )}
          value={form.intro_speech}
          placeholder="Hi, thanks for coming in…"
          onChange={(e) => set('intro_speech', e.target.value)}
        />
        <label className="flex flex-col gap-0.5 border-t border-gray-100 pt-3">
          <span className="text-text-subtle text-xs">
            Recording reminder, shown before they hit record
          </span>
          <input
            className={cn(INLINE, 'text-sm')}
            value={form.recording_reminder}
            onChange={(e) => set('recording_reminder', e.target.value)}
          />
        </label>
      </Section>

      <Section
        title="Questions"
        count={questions.length}
        {...section('questions')}
        view={
          questions.length === 0 ? null : (
            <ol className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-text-faint w-5 shrink-0 tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink">
                      {q.prompt || 'Untitled question'}
                    </span>
                    {(q.followUps ?? []).filter(Boolean).map((f, j) => (
                      <span
                        key={j}
                        className="text-text-muted mt-0.5 flex gap-1.5 text-xs"
                      >
                        <CornerDownRight
                          size={12}
                          className="mt-0.5 shrink-0"
                        />
                        {f}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          )
        }
      >
        <ol className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <li key={i} className="group flex gap-3">
              <span className="text-text-faint w-5 shrink-0 pt-1.5 text-sm tabular-nums">
                {i + 1}.
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start gap-1">
                  <textarea
                    aria-label={`Question ${i + 1}`}
                    className={cn(INLINE, 'text-ink text-sm font-medium')}
                    value={q.prompt}
                    placeholder="Ask something…"
                    onChange={(e) =>
                      setQuestion(i, { ...q, prompt: e.target.value })
                    }
                  />
                  <span className="flex shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <IconButton
                      label="Move up"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton
                      label="Move down"
                      disabled={i === questions.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={14} />
                    </IconButton>
                    <IconButton
                      label="Remove question"
                      onClick={() =>
                        set(
                          'questions',
                          questions.filter((_, idx) => idx !== i)
                        )
                      }
                    >
                      <X size={14} />
                    </IconButton>
                  </span>
                </div>
                <FollowUps
                  items={q.followUps ?? []}
                  onChange={(followUps) => setQuestion(i, { ...q, followUps })}
                />
              </div>
            </li>
          ))}
        </ol>
        <AddButton
          onClick={() => set('questions', [...questions, { prompt: '' }])}
        >
          Add question
        </AddButton>
      </Section>

      <Section
        title="Code challenge"
        {...section('challenge')}
        view={
          form.challenge_intro ||
          tracks.some((t) => t.track.followUps.length) ? (
            <>
              <Clamped text={form.challenge_intro} lines={2} />
              <div className="grid gap-4 sm:grid-cols-2">
                {tracks.map(({ key, track }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-ink text-xs font-semibold">
                      {track.label || 'Untitled'}
                    </span>
                    {track.followUps.filter(Boolean).map((f, j) => (
                      <span
                        key={j}
                        className="text-text-muted flex gap-1.5 text-xs"
                      >
                        <CornerDownRight
                          size={12}
                          className="mt-0.5 shrink-0"
                        />
                        {f}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : null
        }
      >
        <textarea
          aria-label="Challenge intro"
          className={cn(INLINE, 'text-text-default text-sm leading-relaxed')}
          value={form.challenge_intro}
          placeholder="Let's talk about your challenge…"
          onChange={(e) => set('challenge_intro', e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {tracks.map(({ key, track }) => (
            <Track
              key={key}
              track={track}
              onChange={(next) =>
                set('challenge_tracks', {
                  ...form.challenge_tracks,
                  [key]: next,
                })
              }
            />
          ))}
        </div>
      </Section>

      <Section
        title="Closing"
        {...section('closing')}
        view={
          form.closing_note ? (
            <Clamped text={form.closing_note} lines={2} />
          ) : null
        }
      >
        <textarea
          aria-label="Closing note"
          className={cn(INLINE, 'text-text-default text-sm leading-relaxed')}
          value={form.closing_note}
          placeholder="Thanks so much for your time…"
          onChange={(e) => set('closing_note', e.target.value)}
        />
      </Section>

      <Section
        title="After the interview"
        count={form.post_interview_checklist.length}
        {...section('after')}
        view={
          form.post_interview_checklist.length === 0 ? null : (
            <ul className="flex flex-col gap-1">
              {form.post_interview_checklist.map((item, i) => (
                <li
                  key={i}
                  className="text-ink flex items-center gap-2 text-sm"
                >
                  <span className="size-3 shrink-0 border border-gray-300" />
                  {item}
                </li>
              ))}
            </ul>
          )
        }
      >
        <ListEditor
          items={form.post_interview_checklist}
          onChange={(next) => set('post_interview_checklist', next)}
          placeholder="Upload the recording"
          addLabel="Add item"
        />
      </Section>
    </div>
  )
}

function Section({
  title,
  count,
  editing,
  onToggle,
  view,
  children,
}: {
  title: string
  count?: number
  editing: boolean
  onToggle?: () => void
  view: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className={cn('flex flex-col gap-3', editing && 'border-ink')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-ink text-sm font-semibold">
          {title}
          {count !== undefined && count > 0 && (
            <span className="text-text-subtle ml-1.5 font-normal tabular-nums">
              {count}
            </span>
          )}
        </h2>
        {onToggle &&
          (editing ? (
            <button
              type="button"
              onClick={onToggle}
              className="bg-ink px-3 py-1 text-xs font-medium text-white"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              className="text-text-muted hover:text-ink flex items-center gap-1 text-xs"
            >
              <Pencil size={12} /> Edit
            </button>
          ))}
      </div>
      {editing
        ? children
        : (view ?? (
            <p className="text-text-subtle text-sm">
              Nothing yet.
              {onToggle && (
                <button
                  type="button"
                  onClick={onToggle}
                  className="text-ink ml-1 underline-offset-2 hover:underline"
                >
                  Add it
                </button>
              )}
            </p>
          ))}
    </Card>
  )
}

function Clamped({ text, lines }: { text: string; lines: 2 | 3 }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  const long = text.length > (lines === 2 ? 180 : 280)
  return (
    <div className="flex flex-col items-start gap-1">
      <p
        className={cn(
          'text-text-default text-sm leading-relaxed whitespace-pre-line',
          !open && (lines === 2 ? 'line-clamp-2' : 'line-clamp-3')
        )}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-text-muted hover:text-ink text-xs"
        >
          {open ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="text-text-subtle hover:text-ink p-1 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function AddButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-text-muted hover:text-ink hover:border-ink flex w-full items-center justify-center gap-1.5 border border-dashed border-gray-300 bg-white px-3 py-2.5 text-sm transition-colors"
    >
      <Plus size={14} /> {children}
    </button>
  )
}

function FollowUps({
  items,
  onChange,
}: {
  items: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-1 pl-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <CornerDownRight size={13} className="text-text-faint shrink-0" />
          <input
            aria-label={`Follow-up ${i + 1}`}
            value={item}
            placeholder="A deeper prompt…"
            onChange={(e) =>
              onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))
            }
            className="placeholder:text-text-faint focus:border-ink min-w-0 flex-1 border-b border-transparent bg-transparent py-1 text-sm outline-none hover:border-gray-200"
          />
          <IconButton
            label="Remove follow-up"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            <X size={13} />
          </IconButton>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="text-text-subtle hover:text-ink flex w-fit items-center gap-1 text-xs"
      >
        <Plus size={12} /> Follow-up
      </button>
    </div>
  )
}

function ListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
  addLabel: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-4 shrink-0 border border-gray-300" />
          <input
            aria-label={`Item ${i + 1}`}
            value={item}
            placeholder={placeholder}
            onChange={(e) =>
              onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))
            }
            className={cn(INLINE, 'mx-0 w-auto flex-1 text-sm')}
          />
          <IconButton
            label="Remove item"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            <X size={14} />
          </IconButton>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="text-text-subtle hover:text-ink flex w-fit items-center gap-1 pt-1 text-xs"
      >
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  )
}

function Track({
  track,
  onChange,
}: {
  track: InterviewScriptChallengeTrack
  onChange: (next: InterviewScriptChallengeTrack) => void
}) {
  return (
    <Card className="flex flex-col gap-2">
      <input
        aria-label="Track name"
        value={track.label}
        placeholder="Track name"
        onChange={(e) => onChange({ ...track, label: e.target.value })}
        className="text-ink focus:border-ink border-b border-transparent bg-transparent py-1 text-sm font-semibold outline-none hover:border-gray-200"
      />
      <FollowUps
        items={track.followUps}
        onChange={(followUps) => onChange({ ...track, followUps })}
      />
    </Card>
  )
}
