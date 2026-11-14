'use client'
import { PageContainer } from '@/components/PageContainer'
import {
  TABLE_CELL,
  TABLE_FRAME,
  TABLE_HEAD,
  TABLE_ROW,
} from '@/components/ui/table-styles'
import { cn } from '@/lib/utils'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'

import { useMemo, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  ReviewQuestion,
  ReviewQuestionAverage,
  Role,
} from '@/lib/api/types'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useReviewQuestionAverages } from '@/lib/queries/review-question-averages'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

// How far a lead's average has to sit from the question's overall average
// before it's called out as scoring that question notably high/low.
const DEVIATION_THRESHOLD = 1

export function ReviewCalibrationClient() {
  const { data: cycles = [] } = useCycles({})

  // Scope the page to one cycle, same default as the other chief-only
  // pipeline pages.
  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }
  const [activeRole, setActiveRole] = useState<Role | 'all'>('all')

  const roles = activeRole === 'all' ? ROLE_COLUMNS : [activeRole]

  return (
    <PageContainer>
      <PageHeader
        title="Review calibration"
        subtitle="Each lead’s average score on every review question, next to the overall average — a quick check for who’s scoring a question notably high or low."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={activeRole}
              onValueChange={(val) => setActiveRole(val as Role | 'all')}
            >
              <SelectTrigger className="w-56" aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_COLUMNS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="w-40" aria-label="Filter by cycle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {roles.map((role) => (
        <RoleTable key={role} cycleId={cycleId} role={role} />
      ))}
    </PageContainer>
  )
}

function cellClass(diff: number | null) {
  if (diff == null) return 'text-text-faint'
  if (diff >= DEVIATION_THRESHOLD) return 'bg-status-open/10 text-status-open'
  if (diff <= -DEVIATION_THRESHOLD) return 'bg-red-50 text-red-700'
  return 'text-text-default'
}

function RoleTable({ cycleId, role }: { cycleId: string; role: Role }) {
  const { data: questions = [], isLoading: questionsLoading } =
    useReviewQuestions(cycleId, role)
  const { data: averages = [], isLoading: averagesLoading } =
    useReviewQuestionAverages(cycleId, role)

  const scoreQuestions = useMemo(
    () => questions.filter((q) => q.question_type === 'score'),
    [questions]
  )

  // Only leads who've actually scored something for this role, most active
  // first — an all-zero row for a lead with no reviews here adds noise.
  const leads = useMemo(
    () =>
      averages
        .filter((a) => a.scores.length > 0)
        .sort((a, b) => totalCount(b) - totalCount(a)),
    [averages]
  )

  const overallByQuestion = useMemo(
    () => computeOverallAverages(averages),
    [averages]
  )

  const isLoading = questionsLoading || averagesLoading

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{ROLE_LABEL[role]}</SectionLabel>

      {isLoading ? (
        <LoadingText className="px-1" />
      ) : scoreQuestions.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No scored review questions are set up for this cycle/role yet.
        </p>
      ) : leads.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No written reviews have been scored for this cycle/role yet.
        </p>
      ) : (
        <div className={TABLE_FRAME}>
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr>
                <th className={cn(TABLE_HEAD, 'text-left')}>Lead</th>
                {scoreQuestions.map((q) => (
                  <th
                    key={q.id}
                    className={cn(TABLE_HEAD, 'max-w-56 text-left')}
                    title={q.question_text}
                  >
                    {q.question_text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className={cn(TABLE_ROW, 'bg-gray-50')}>
                <td className={cn(TABLE_CELL, 'text-text-default font-medium')}>
                  Overall average
                </td>
                {scoreQuestions.map((q) => {
                  const overall = overallByQuestion[q.id]
                  return (
                    <td
                      key={q.id}
                      className={cn(TABLE_CELL, 'text-text-default')}
                    >
                      {overall != null ? overall.toFixed(1) : '—'}
                    </td>
                  )
                })}
              </tr>
              {leads.map((lead) => (
                <LeadRow
                  key={lead.lead_nuid}
                  lead={lead}
                  questions={scoreQuestions}
                  overallByQuestion={overallByQuestion}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LeadRow({
  lead,
  questions,
  overallByQuestion,
}: {
  lead: ReviewQuestionAverage
  questions: ReviewQuestion[]
  overallByQuestion: Record<string, number | undefined>
}) {
  const scoreByQuestion = useMemo(
    () => new Map(lead.scores.map((s) => [s.review_question_id, s])),
    [lead.scores]
  )

  return (
    <tr className={TABLE_ROW}>
      <td className={cn(TABLE_CELL, 'text-text-default font-medium')}>
        {lead.full_name || lead.lead_nuid}
      </td>
      {questions.map((q) => {
        const score = scoreByQuestion.get(q.id)
        const overall = overallByQuestion[q.id]
        const diff = score && overall != null ? score.avg_score - overall : null
        return (
          <td key={q.id} className={cn(TABLE_CELL, cellClass(diff))}>
            {score ? `${score.avg_score.toFixed(1)} (${score.count})` : '—'}
          </td>
        )
      })}
    </tr>
  )
}

function totalCount(lead: ReviewQuestionAverage) {
  return lead.scores.reduce((sum, s) => sum + s.count, 0)
}

// Un-weighted average of each question's per-lead averages — a simple
// reference point for "is this lead's average notably off from everyone
// else's," not a re-derivation of the true per-answer mean.
function computeOverallAverages(averages: ReviewQuestionAverage[]) {
  const sums: Record<string, { total: number; n: number }> = {}
  for (const lead of averages) {
    for (const s of lead.scores) {
      const entry = sums[s.review_question_id] ?? { total: 0, n: 0 }
      entry.total += s.avg_score
      entry.n += 1
      sums[s.review_question_id] = entry
    }
  }
  const result: Record<string, number | undefined> = {}
  for (const [questionId, { total, n }] of Object.entries(sums)) {
    result[questionId] = n > 0 ? total / n : undefined
  }
  return result
}
