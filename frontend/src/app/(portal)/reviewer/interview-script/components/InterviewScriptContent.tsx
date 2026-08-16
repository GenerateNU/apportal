'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { InterviewScriptQuestion } from '@/lib/api/types'
import { useInterviewScript } from '@/lib/queries/interview-script'

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
      {children}
    </h3>
  )
}

function QuestionItem({
  question,
  index,
}: {
  question: InterviewScriptQuestion
  index: number
}) {
  const [open, setOpen] = useState(false)
  const hasFollowUps = !!question.followUps?.length

  return (
    <li className="rounded-lg border border-gray-100 bg-white p-3">
      <p className="text-text-default text-sm">
        <span className="text-text-faint">{index + 1}.</span> {question.prompt}
      </p>
      {hasFollowUps && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-text-muted hover:text-text-default mt-1.5 inline-flex items-center gap-1 text-xs"
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {open
              ? 'Hide follow-ups'
              : `Follow-ups (${question.followUps?.length})`}
          </button>
          {open && (
            <ul className="mt-2 flex flex-col gap-1.5 border-l-2 border-gray-100 pl-3">
              {question.followUps?.map((f) => (
                <li key={f} className="text-text-muted text-sm">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}

export function InterviewScriptContent() {
  const { data: script, isLoading } = useInterviewScript()

  if (isLoading || !script) {
    return <p className="text-text-faint text-sm">Loading script…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SectionHeading>Intro speech</SectionHeading>
        <p className="text-text-faint text-xs italic">
          Read this to every applicant for posterity.
        </p>
        <div className="text-text-default flex flex-col gap-3 text-sm whitespace-pre-line">
          {script.intro_speech.split('\n\n').map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
        {script.recording_reminder}
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeading>Questions</SectionHeading>
        <ul className="flex flex-col gap-2">
          {script.questions.map((q, i) => (
            <QuestionItem key={q.prompt} question={q} index={i} />
          ))}
        </ul>
        <p className="text-text-muted text-sm">{script.closing_note}</p>
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeading>Challenge</SectionHeading>
        <p className="text-text-muted text-sm">{script.challenge_intro}</p>
        {(
          [
            script.challenge_tracks.backend,
            script.challenge_tracks.frontend,
          ] as const
        ).map((track) => (
          <div key={track.label} className="flex flex-col gap-2">
            <p className="text-text-default text-sm font-medium">
              {track.label}
            </p>
            <ul className="flex flex-col gap-1.5 border-l-2 border-gray-100 pl-3">
              {track.followUps.map((f) => (
                <li key={f} className="text-text-muted text-sm">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeading>Post interview</SectionHeading>
        <ol className="flex list-decimal flex-col gap-1 pl-4">
          {script.post_interview_checklist.map((item) => (
            <li key={item} className="text-text-default text-sm">
              {item}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
