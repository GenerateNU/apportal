'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, type LucideIcon, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { ReviewQuestion } from '@/lib/api/types'
import { useUpdateReviewQuestion } from '@/lib/queries/review-questions'
import { cn } from '@/lib/utils'

const SCALES = [
  { min: 1, max: 5 },
  { min: 1, max: 10 },
]

export function Scoring({
  roleName,
  rubric,
}: {
  roleName: string
  rubric: ReviewQuestion[]
}) {
  const [open, setOpen] = useState(false)
  const sameScale = rubric.every(
    (q) =>
      q.score_min === rubric[0].score_min && q.score_max === rubric[0].score_max
  )
  const counted = rubric.filter((q) => q.ranked).length
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-text-muted hover:text-ink flex items-center gap-1 self-start px-1 text-xs"
      >
        {sameScale
          ? `Scored ${rubric[0].score_min}–${rubric[0].score_max}`
          : 'Mixed scales'}
        {' · '}
        {counted} of {rubric.length} count toward cutoff
        <span className="text-ink font-medium underline-offset-2 hover:underline">
          · {open ? 'Done' : 'Change'}
        </span>
      </button>
      {open && <RubricSettings roleName={roleName} rubric={rubric} />}
    </>
  )
}

export function FormTile({
  title,
  audience,
  icon: Icon,
  hint,
  count,
  noun,
  href,
}: {
  title: string
  audience: string
  icon: LucideIcon
  hint: string
  count: number
  noun: string
  href: string
}) {
  const done = count > 0
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-stretch gap-3 border p-4 transition-colors',
        done
          ? 'border-gray-200 bg-white hover:border-gray-400'
          : 'hover:border-ink border-dashed border-gray-300 bg-gray-50/60 hover:bg-white'
      )}
    >
      <span
        className={cn(
          'relative flex size-14 shrink-0 items-center justify-center self-center',
          done ? 'bg-ink text-white' : 'text-ink/60 bg-gray-100'
        )}
      >
        <Icon size={22} />
        {done && (
          <span className="bg-status-open absolute -right-1.5 -bottom-1.5 flex size-4 items-center justify-center rounded-full text-white ring-2 ring-white">
            <Check size={10} strokeWidth={3} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-text-subtle text-[10px] tracking-wider uppercase">
          {audience}
        </div>
        <div className="text-ink font-semibold">{title}</div>
        <div className="text-text-muted truncate text-sm">
          {done ? `${count} ${noun}${count === 1 ? '' : 's'}` : hint}
        </div>
      </div>
      {done ? (
        <span className="text-ink flex shrink-0 items-center gap-1 self-center text-sm font-medium">
          Edit
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      ) : (
        <span className="bg-ink flex shrink-0 items-center gap-1 self-center px-3 py-1.5 text-sm font-semibold text-white">
          <Plus size={14} /> Write
        </span>
      )}
    </Link>
  )
}

export function RubricSettings({
  roleName,
  rubric,
}: {
  roleName: string
  rubric: ReviewQuestion[]
}) {
  const update = useUpdateReviewQuestion()
  const toast = useToast()
  const scales = new Set(rubric.map((q) => `${q.score_min}–${q.score_max}`))

  async function setScale(min: number, max: number) {
    const results = await Promise.allSettled(
      rubric
        .filter((q) => q.score_min !== min || q.score_max !== max)
        .map((q) =>
          update.mutateAsync({
            id: q.id,
            body: { score_min: min, score_max: max },
          })
        )
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    toast(
      failed > 0
        ? `${failed} question${failed === 1 ? ' is' : 's are'} already scored, so the scale is locked.`
        : `${roleName} reviews now score ${min}–${max}`,
      failed > 0 ? { variant: 'error' } : undefined
    )
  }

  return (
    <div className="flex flex-col gap-2.5 border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-muted w-36">Scale</span>
        {SCALES.map((s) => {
          const current = scales.size === 1 && scales.has(`${s.min}–${s.max}`)
          return (
            <Button
              key={s.max}
              size="xs"
              variant={current ? 'default' : 'outline'}
              disabled={update.isPending || current}
              onClick={() => setScale(s.min, s.max)}
            >
              {s.min}–{s.max}
            </Button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-muted w-36">Counts toward cutoff</span>
        {rubric.map((q) => (
          <button
            key={q.id}
            type="button"
            aria-pressed={q.ranked}
            onClick={() =>
              update.mutate({ id: q.id, body: { ranked: !q.ranked } })
            }
            className={cn(
              'max-w-56 truncate border px-2 py-0.5 text-xs transition-colors',
              q.ranked
                ? 'border-ink bg-ink text-white'
                : 'text-text-muted border-gray-200 bg-white hover:border-gray-400'
            )}
          >
            {q.question_text}
          </button>
        ))}
      </div>
    </div>
  )
}
