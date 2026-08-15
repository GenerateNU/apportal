'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  AVAILABILITY_REMINDER,
  CHALLENGE_INTRO,
  CHALLENGE_TRACKS,
  CLOSING_NOTE,
  INTRO_SPEECH,
  POST_INTERVIEW_CHECKLIST,
  QUESTIONS,
  RECORDING_REMINDER,
  type ScriptQuestion,
} from '@/lib/interview-script'

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
  question: ScriptQuestion
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
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SectionHeading>Intro speech</SectionHeading>
        <p className="text-text-faint text-xs italic">
          Read this to every applicant for posterity.
        </p>
        <div className="text-text-default flex flex-col gap-3 text-sm whitespace-pre-line">
          {INTRO_SPEECH.split('\n\n').map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
        {RECORDING_REMINDER}
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeading>Questions</SectionHeading>
        <ul className="flex flex-col gap-2">
          {QUESTIONS.map((q, i) => (
            <QuestionItem key={q.prompt} question={q} index={i} />
          ))}
        </ul>
        <p className="text-text-muted text-sm">{CLOSING_NOTE}</p>
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeading>Challenge</SectionHeading>
        <p className="text-text-muted text-sm">{CHALLENGE_INTRO}</p>
        {Object.values(CHALLENGE_TRACKS).map((track) => (
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {AVAILABILITY_REMINDER}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeading>Post interview</SectionHeading>
        <ol className="flex list-decimal flex-col gap-1 pl-4">
          {POST_INTERVIEW_CHECKLIST.map((item) => (
            <li key={item} className="text-text-default text-sm">
              {item}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
