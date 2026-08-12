import { useRouter } from 'next/navigation'
import type { Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication } from './types'
import { formatDate } from '@/lib/utils'
import { AnswerCell } from './AnswerCell'
import { StageSelect } from './StageSelect'

export function ApplicantRow({
  applicant,
  columns,
  rowQuestions,
  answers,
  answersLoading,
  availabilityDays,
  selectable,
  selected,
  onToggleSelect,
}: {
  applicant: ApplicantApplication
  columns: Question[]
  rowQuestions: Question[]
  answers: WrittenAnswer[]
  // This row's answers haven't arrived yet, so its cells stay blank instead of
  // asserting "No response".
  answersLoading: boolean
  availabilityDays: string[]
  selectable: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const router = useRouter()
  const href = `/reviewer/applications/${applicant.id}`

  // Not a real <a>, so cmd/ctrl-click and middle-click need their own
  // new-tab handling — a plain onClick router.push only ever navigates in
  // this tab.
  function open(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      window.open(href, '_blank')
    } else {
      router.push(href)
    }
  }

  return (
    // A row's content lands in three waves — the application, then its
    // cycle's questions, then its answers — so its height is pinned up front.
    // Without that, every wave reflows the row and the whole list jumps.
    <tr
      onClick={open}
      onAuxClick={open}
      className="h-12 cursor-pointer border-b border-gray-100 bg-white transition-colors hover:bg-gray-50"
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
        <StageSelect applicationId={applicant.id} stage={applicant.stage} />
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
