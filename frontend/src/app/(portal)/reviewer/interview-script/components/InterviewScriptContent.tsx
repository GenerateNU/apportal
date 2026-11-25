'use client'

import { PanelHeading } from '@/components/ui/panel-heading'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { LoadingText } from '@/components/ui/loading-text'
import type { InterviewScriptQuestion } from '@/lib/api/types'
import { useChallenges } from '@/lib/queries/challenges'
import { useInterviewScript } from '@/lib/queries/interview-script'
import { cn } from '@/lib/utils'

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? '[]'
  } catch {
    return '[]'
  }
}

function useChecklist(storageKey?: string) {
  const key = storageKey ? `interview-script:${storageKey}` : ''
  const raw = useSyncExternalStore(
    subscribe,
    () => (key ? readStored(key) : '[]'),
    () => '[]'
  )
  const checked = useMemo(() => {
    try {
      return new Set(JSON.parse(raw) as string[])
    } catch {
      return new Set<string>()
    }
  }, [raw])
  const toggle = (id: string) => {
    if (!key) return
    const next = new Set(checked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    try {
      localStorage.setItem(key, JSON.stringify([...next]))
    } catch {}
    listeners.forEach((cb) => cb())
  }
  return { checked, toggle, enabled: !!key }
}

function CheckBox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'mt-0.5 flex size-5 shrink-0 items-center justify-center border transition-colors',
        checked
          ? 'border-ink bg-ink text-white'
          : 'hover:border-ink border-gray-300 bg-white'
      )}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </button>
  )
}

function QuestionItem({
  question,
  index,
  checked,
  onToggle,
}: {
  question: InterviewScriptQuestion
  index: number
  checked?: boolean
  onToggle?: () => void
}) {
  const [open, setOpen] = useState(false)
  const followUps = question.followUps ?? []

  return (
    <li className="flex gap-4 border-b border-gray-100 py-4 last:border-b-0">
      <span className="font-display text-text-subtle w-6 shrink-0 pt-0.5 text-sm font-bold">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p
          className={cn(
            'text-base leading-relaxed transition-colors',
            checked ? 'text-text-subtle' : 'text-ink'
          )}
        >
          {question.prompt}
        </p>
        {followUps.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-text-muted hover:text-ink inline-flex w-fit items-center gap-1 text-xs"
            >
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {followUps.length} follow-up{followUps.length === 1 ? '' : 's'}
            </button>
            {open && (
              <ul className="flex flex-col gap-1.5 border-l-2 border-gray-200 pl-3">
                {followUps.map((f) => (
                  <li key={f} className="text-text-muted text-sm">
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {onToggle && (
        <CheckBox
          checked={!!checked}
          onToggle={onToggle}
          label={`Mark question ${index + 1} as asked`}
        />
      )}
    </li>
  )
}

function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <PanelHeading as="h3" aside={aside}>
        {title}
      </PanelHeading>
      {children}
    </section>
  )
}

function ReadAloud({ text }: { text: string }) {
  return (
    <blockquote className="border-ink text-ink flex flex-col gap-3 border-l-2 pl-4 text-base leading-relaxed">
      {text.split('\n\n').map((paragraph) => (
        <p key={paragraph} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </blockquote>
  )
}

export function InterviewScriptContent({
  cycleId,
  role,
  checklistKey,
}: {
  cycleId: string
  role: string
  checklistKey?: string
}) {
  const { data: script, isLoading } = useInterviewScript(cycleId, role)
  const { data: challenges = [] } = useChallenges(cycleId, role)
  const { checked, toggle, enabled } = useChecklist(checklistKey)

  if (isLoading || !script) {
    return <LoadingText label="Loading script…" />
  }

  const asked = script.questions.filter((q) => checked.has(`q:${q.prompt}`))
  const tracks = script.challenge_tracks.filter((t) =>
    t.followUps.some(Boolean)
  )

  return (
    <div className="flex flex-col gap-10">
      <Section title="Intro" aside="Read aloud">
        <ReadAloud text={script.intro_speech} />
      </Section>

      {script.recording_reminder && (
        <div className="flex items-start gap-3 border border-gray-200 bg-gray-50 px-4 py-3">
          <span className="bg-destructive mt-1.5 size-2 shrink-0 rounded-full" />
          <p className="text-ink text-sm font-medium">
            {script.recording_reminder}
          </p>
        </div>
      )}

      <Section
        title="Questions"
        aside={
          enabled
            ? `${asked.length} of ${script.questions.length} asked`
            : `${script.questions.length} questions`
        }
      >
        <ol className="border-t border-gray-200">
          {script.questions.map((q, i) => (
            <QuestionItem
              key={q.prompt}
              question={q}
              index={i}
              checked={checked.has(`q:${q.prompt}`)}
              onToggle={enabled ? () => toggle(`q:${q.prompt}`) : undefined}
            />
          ))}
        </ol>
        {script.closing_note && (
          <p className="text-text-muted text-sm">{script.closing_note}</p>
        )}
      </Section>

      {challenges.length > 0 && (
        <Section title="Challenge">
          {script.challenge_intro && (
            <p className="text-text-muted text-sm leading-relaxed">
              {script.challenge_intro}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {tracks.map((track, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 border border-gray-200 p-4"
              >
                <span className="font-display text-ink text-xs font-bold tracking-wider uppercase">
                  {track.label}
                </span>
                <ul className="flex flex-col gap-1.5">
                  {track.followUps.map((f) => (
                    <li key={f} className="text-text-default text-sm">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="After the interview">
        <ul className="flex flex-col gap-2">
          {script.post_interview_checklist.map((item) => (
            <li key={item} className="flex items-start gap-3">
              {enabled ? (
                <CheckBox
                  checked={checked.has(`p:${item}`)}
                  onToggle={() => toggle(`p:${item}`)}
                  label={item}
                />
              ) : (
                <span className="mt-2 size-1.5 shrink-0 bg-gray-400" />
              )}
              <span
                className={cn(
                  'text-sm',
                  checked.has(`p:${item}`) ? 'text-text-subtle' : 'text-ink'
                )}
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
