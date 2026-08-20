import type { Interview, Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication } from './types'
import { formatDate } from '@/lib/utils'
import { AnswerCell } from './AnswerCell'
import { StageSelect } from './StageSelect'
import { RATING_LABEL } from '@/lib/interview-ratings'
import type { InterviewRating } from '@/lib/api/types'

const RATING_COLORS: Record<InterviewRating, { bg: string; text: string }> = {
  must_hire: { bg: 'bg-green-100', text: 'text-green-700' },
  great: { bg: 'bg-teal-100', text: 'text-teal-700' },
  good: { bg: 'bg-blue-100', text: 'text-blue-700' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-700' },
  do_not_hire: { bg: 'bg-red-100', text: 'text-red-700' },
}

export function ApplicantRow({
  applicant,
  columns,
  rowQuestions,
  answers,
  answersLoading,
  availabilityDays,
  interview,
  selectable,
  selected,
  onToggleSelect,
  isSelected,
  onSelect,
}: {
  applicant: ApplicantApplication
  columns: Question[]
  rowQuestions: Question[]
  answers: WrittenAnswer[]
  // This row's answers haven't arrived yet, so its cells stay blank instead of
  // asserting "No response".
  answersLoading: boolean
  availabilityDays: string[]
  interview: Interview | null
  selectable: boolean
  selected: boolean
  onToggleSelect: () => void
  isSelected: boolean
  onSelect: () => void
}) {
  // Cmd/ctrl-click and middle-click bypass the side peek and open the
  // standalone /reviewer/applications/[id] page in a new tab instead — a
  // real page, not a real <a>, so it needs its own handling rather than
  // relying on the browser's native new-tab behavior.
  function handleClick(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey) {
      window.open(`/reviewer/applications/${applicant.id}`, '_blank')
    } else {
      onSelect()
    }
  }

  function handleAuxClick(e: React.MouseEvent) {
    if (e.button === 1) {
      window.open(`/reviewer/applications/${applicant.id}`, '_blank')
    }
  }

  return (
    // A row's content lands in three waves — the application, then its
    // cycle's questions, then its answers — so its height is pinned up front.
    // Without that, every wave reflows the row and the whole list jumps.
    <tr
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      className={`h-12 cursor-pointer border-b border-gray-100 transition-colors ${
        isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {selectable && (
        <td
          className="border-r border-gray-100 px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="accent-primary"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${applicant.fullName}`}
          />
        </td>
      )}
      <td className="min-w-36 border-r border-gray-100 px-3 py-2 whitespace-nowrap">
        {interview?.rating ? (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${RATING_COLORS[interview.rating].bg} ${RATING_COLORS[interview.rating].text}`}
          >
            {RATING_LABEL[interview.rating]}
          </span>
        ) : (
          <span className="text-text-faint text-sm">—</span>
        )}
      </td>
      {columns.map((q) => {
        const rowQuestion = rowQuestions.find(
          (rq) =>
            rq.question_text.trim().toLowerCase() ===
            q.question_text.trim().toLowerCase()
        )
        return (
          <td
            key={q.id}
            className="border-r border-gray-100 px-3 py-2 last:border-r-0"
          >
            <AnswerCell
              answer={
                rowQuestion
                  ? answers.find((a) => a.question_id === rowQuestion.id)
                  : undefined
              }
              applicable={!!rowQuestion}
              questionType={q.question_type}
              loading={answersLoading}
            />
          </td>
        )
      })}
      <td className="border-r border-gray-100 px-3 py-2 whitespace-nowrap">
        <StageSelect
          applicationId={applicant.id}
          stage={applicant.stage}
          editable={selectable}
        />
      </td>
      <td className="text-text-muted px-3 py-2 text-sm whitespace-nowrap">
        {formatDate(applicant.submittedAt)}
      </td>
      <td className="border-r border-gray-100 px-3 py-2 whitespace-nowrap">
        {availabilityDays.length > 0 ? (
          // Four day chips are wider than the "Availability" header, so
          // wrapping would put them on two lines and make this the tallest
          // cell in the row — and they arrive last, so the row would grow
          // after everything else had settled.
          <div className="flex flex-nowrap gap-1">
            {availabilityDays.map((d) => (
              <span
                key={d}
                className="text-text-secondary inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium"
              >
                {d}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-text-faint text-sm">—</span>
        )}
      </td>
    </tr>
  )
}
