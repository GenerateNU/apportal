'use client'

import { useState, useEffect } from 'react'
import {
  ListFilter,
  Plus,
  X,
  Type,
  Link,
  CheckSquare,
  MoreHorizontal,
  Star,
  Layers,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import type { Question, QuestionType, Role } from '@/lib/api/types'
import { RATING_OPTIONS } from '@/lib/interview-ratings'
import { ORDERED_STAGES, stageLabel } from './constants'

// The wire shape the backend expects: a substring for free-text questions, a
// list of chosen labels for choice questions.
type FilterValue = string | string[]

export interface AnswerFilter {
  question_id: string
  question_text: string
  question_type: QuestionType
  values: FilterValue
  // Set when the filter targets something on the application itself rather
  // than an answer to one of its questions — those go out as their own query
  // params, not as answer_filters.
  special?: SpecialFilter
}

export type SpecialFilter = 'rating' | 'stage'

const SPECIAL_FILTER_ID: Record<SpecialFilter, string> = {
  rating: '__rating__',
  stage: '__stage__',
}

// Synthetic "questions", so the pickers below treat these exactly like a
// dropdown question and render the same checkbox list.
function specialQuestion(
  special: SpecialFilter,
  question_text: string,
  options: string[]
): Question {
  return {
    id: SPECIAL_FILTER_ID[special],
    question_text,
    question_type: 'dropdown',
    options,
    display_order: -1,
    is_required: false,
    cycle_id: '',
    role: 'backend_developer' as Role,
    created_at: '',
  }
}

const SPECIAL_QUESTIONS: { special: SpecialFilter; question: Question }[] = [
  {
    special: 'rating',
    question: specialQuestion(
      'rating',
      'Interview Rating',
      RATING_OPTIONS.map((r) => r.label)
    ),
  },
  {
    special: 'stage',
    question: specialQuestion(
      'stage',
      'Stage',
      ORDERED_STAGES.map((s) => stageLabel[s])
    ),
  },
]

// Question types whose answers are picked from a fixed option list, so the
// filter offers checkboxes instead of a text box.
const CHOICE_TYPES: QuestionType[] = ['checkbox', 'dropdown', 'multiple_choice']

function isChoiceQuestion(type: QuestionType) {
  return CHOICE_TYPES.includes(type)
}

export type FilterChangeHandler = (
  filter: AnswerFilter | null,
  action: 'add' | 'update' | 'remove'
) => void

interface FilterChipsProps {
  filters: AnswerFilter[]
  columns: Question[]
  onFilterChange: FilterChangeHandler
}

export function FilterChips({
  filters,
  columns,
  onFilterChange,
}: FilterChipsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filterValues, setFilterValues] = useState<Record<string, FilterValue>>(
    {}
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null)

  useEffect(() => {
    if (activeQuestionId) {
      // Find and focus the text input for this question
      const input = document.querySelector(
        `input[data-question-id="${activeQuestionId}"]`
      ) as HTMLInputElement
      if (input) {
        input.focus()
      }
    }
  }, [activeQuestionId])

  // One filter per question (plus the special ones), so anything already
  // filtered on drops off the list of things you can add.
  const availableColumns = [
    ...SPECIAL_QUESTIONS.filter(
      ({ special }) => !filters.some((f) => f.special === special)
    ).map(({ question }) => question),
    ...columns.filter((q) => !filters.some((f) => f.question_id === q.id)),
  ]

  const filteredColumns = availableColumns.filter((q) =>
    q.question_text.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Clearing the entry outright, rather than setting it to undefined, keeps
  // the map's values non-nullable.
  const clearFilterValue = (questionId: string) => {
    setFilterValues((prev) => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }

  const commitFilter = (q: Question) => {
    const values = filterValues[q.id]
    if (!hasValue(values)) return
    onFilterChange(
      {
        question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        values,
        special: specialOf(q.id),
      },
      'add'
    )
    setIsOpen(false)
    setActiveQuestionId(null)
    clearFilterValue(q.id)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <FilterChip
          key={filter.question_id}
          filter={filter}
          question={questionForFilter(filter, columns)}
          onUpdate={(values) => onFilterChange({ ...filter, values }, 'update')}
          onRemove={() => onFilterChange(filter, 'remove')}
        />
      ))}

      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            onClick={() => {
              setActiveQuestionId(null)
              setFilterValues({})
              setSearchTerm('')
            }}
            className={`text-text-muted inline-flex h-7 items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-50 ${
              filters.length === 0 ? 'gap-1.5 px-2 text-sm' : 'w-7'
            }`}
            title="Add filter"
          >
            {filters.length === 0 && (
              <>
                <ListFilter className="h-3.5 w-3.5" />
                Filter
              </>
            )}
            <Plus className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-72 overflow-visible p-0"
          onKeyDown={preventMenuNavigation}
        >
          <div className="border-b border-gray-200 px-2 py-1.5">
            <Input
              type="text"
              placeholder="Filter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 border-0 px-2 text-sm outline-none focus:ring-0 focus:outline-none focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredColumns.length > 0 ? (
              filteredColumns.map((q) => (
                <DropdownMenuSub key={q.id}>
                  <DropdownMenuSubTrigger
                    onMouseEnter={() => setActiveQuestionId(q.id)}
                    className="border-b border-gray-100 px-3 py-2 text-left last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {getFilterIcon(specialOf(q.id), q.question_type)}
                      <div className="min-w-0 flex-1">
                        <div className="text-text-default truncate text-sm font-medium">
                          {q.question_text}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuSubTrigger>
                  {/* Radix leaves submenus flush against the parent panel, so
                      this offset is what separates the two surfaces. */}
                  <DropdownMenuSubContent sideOffset={8} className="w-72 p-0">
                    <FilterValueEditor
                      question={q}
                      value={filterValues[q.id]}
                      onChange={(value) => {
                        if (activeQuestionId !== q.id) setActiveQuestionId(q.id)
                        setFilterValues({ ...filterValues, [q.id]: value })
                      }}
                      onCommit={() => commitFilter(q)}
                      commitLabel="Add"
                    />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))
            ) : (
              <div className="text-text-muted px-4 py-6 text-center text-sm">
                No filters available
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// The filter's own question: the synthetic one for stage/rating, otherwise
// the cycle+role question it was built from.
function questionForFilter(
  filter: AnswerFilter,
  columns: Question[]
): Question | undefined {
  if (filter.special) {
    return SPECIAL_QUESTIONS.find(({ special }) => special === filter.special)
      ?.question
  }
  return columns.find((q) => q.id === filter.question_id)
}

function getDisplayValue(filter: AnswerFilter): string {
  return typeof filter.values === 'string'
    ? filter.values
    : filter.values.join(', ')
}

// An empty string or an empty selection would match everything, so neither
// counts as a filter worth sending.
function hasValue(value: FilterValue | undefined): value is FilterValue {
  return typeof value === 'string' ? value.trim() !== '' : !!value?.length
}

// Prevent dropdown navigation keys except when in inputs.
function preventMenuNavigation(e: React.KeyboardEvent) {
  const target = e.target as HTMLElement
  if (
    target.tagName !== 'INPUT' &&
    ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)
  ) {
    e.preventDefault()
  }
}

// Clicking a chip reopens its own editor with the current selection loaded,
// so narrowing a filter doesn't mean removing it and building it again.
function FilterChip({
  filter,
  question,
  onUpdate,
  onRemove,
}: {
  filter: AnswerFilter
  // Absent once the filter's question leaves the current cycle+role, which
  // leaves the chip readable but not editable.
  question?: Question
  onUpdate: (values: FilterValue) => void
  onRemove: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState<FilterValue>(filter.values)

  // Mirrors how the backend matches: choice answers are compared whole and any
  // of them counts as a match, everything else by substring.
  const middleText = !isChoiceQuestion(filter.question_type)
    ? 'contains'
    : Array.isArray(filter.values) && filter.values.length > 1
      ? 'is one of'
      : 'is'

  const segments = (
    <>
      <span className="flex items-center gap-1.5 px-2">
        {getFilterIcon(filter.special, filter.question_type, 'h-3.5 w-3.5')}
        <span className="text-text-default max-w-[11rem] truncate">
          {filter.question_text}
        </span>
      </span>
      <span className="text-text-muted flex items-center border-l border-gray-200 px-2">
        {middleText}
      </span>
      <span className="text-text-default flex max-w-[12rem] items-center border-l border-gray-200 px-2">
        <span className="truncate">{getDisplayValue(filter)}</span>
      </span>
    </>
  )

  const commit = () => {
    if (!hasValue(draft)) return
    onUpdate(draft)
    setIsOpen(false)
  }

  return (
    // Segments size to their content and are separated by hairlines, so a chip
    // stays as narrow as what it says. Long question text and long values
    // truncate rather than stretching the row.
    <div className="inline-flex h-7 items-stretch overflow-hidden rounded-md border border-gray-200 bg-gray-50 text-sm">
      {question ? (
        <DropdownMenu
          open={isOpen}
          onOpenChange={(open) => {
            // Reload from the chip on every open, so an abandoned edit doesn't
            // carry into the next one.
            if (open) setDraft(filter.values)
            setIsOpen(open)
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-stretch transition-colors hover:bg-gray-100"
              title="Edit filter"
            >
              {segments}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-72 p-0"
            onKeyDown={preventMenuNavigation}
          >
            <FilterValueEditor
              question={question}
              value={draft}
              onChange={setDraft}
              onCommit={commit}
              commitLabel="Update"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-stretch">{segments}</div>
      )}
      <button
        onClick={onRemove}
        className="text-text-muted hover:text-text-default flex items-center border-l border-gray-200 px-1.5 transition-colors hover:bg-gray-100"
        title="Remove filter"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// The value half of a filter — option checkboxes or a substring box, plus the
// button that commits. Shared by the add menu and by editing a chip.
function FilterValueEditor({
  question,
  value,
  onChange,
  onCommit,
  commitLabel,
}: {
  question: Question
  value: FilterValue | undefined
  onChange: (value: FilterValue) => void
  onCommit: () => void
  commitLabel: string
}) {
  const choice = isChoiceQuestion(question.question_type)
  const selected = Array.isArray(value) ? value : []

  return (
    <>
      <div className="border-b border-gray-200 px-2 py-1.5">
        <div className="text-text-default truncate text-xs font-medium">
          {question.question_text}
        </div>
      </div>
      <div className="px-2 py-1.5">
        {choice ? (
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {getOptionsForQuestion(question).map((option) => {
              const checkboxId = `filter-${question.id}-${option}`
              return (
                <div key={option} className="flex items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={selected.includes(option)}
                    onCheckedChange={(checked) =>
                      onChange(
                        checked
                          ? [...selected, option]
                          : selected.filter((o) => o !== option)
                      )
                    }
                  />
                  <label
                    htmlFor={checkboxId}
                    className="text-text-default cursor-pointer text-sm font-normal"
                  >
                    {option}
                  </label>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Input
              type="text"
              placeholder="Contains..."
              data-question-id={question.id}
              value={Array.isArray(value) ? '' : (value ?? '')}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') onCommit()
              }}
              autoFocus
              className="h-6 flex-1 border-0 px-2 !text-xs outline-none focus:ring-0 focus:outline-none focus-visible:ring-0"
            />
            <button
              onClick={onCommit}
              disabled={!hasValue(value)}
              className="text-text-muted hover:text-text-default shrink-0 rounded bg-gray-100 px-2 py-1 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {choice && (
        <div className="flex border-t border-gray-200 px-2 py-1.5">
          <button
            onClick={onCommit}
            disabled={!hasValue(value)}
            className="bg-brand-blue hover:bg-brand-blue/90 text-brand-white w-full rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {commitLabel}
          </button>
        </div>
      )}
    </>
  )
}

function getOptionsForQuestion(question: Question): string[] {
  if (!isChoiceQuestion(question.question_type)) return []
  return question.options ?? []
}

function specialOf(questionId: string): SpecialFilter | undefined {
  return SPECIAL_QUESTIONS.find(({ question }) => question.id === questionId)
    ?.special
}

function getFilterIcon(
  special: SpecialFilter | undefined,
  questionType: QuestionType,
  size = 'h-4 w-4'
): React.ReactNode {
  const iconProps = { className: `${size} text-text-muted shrink-0` }

  if (special === 'rating') return <Star {...iconProps} />
  if (special === 'stage') return <Layers {...iconProps} />

  switch (questionType) {
    case 'short_answer':
      return <Type {...iconProps} />
    case 'url':
      return <Link {...iconProps} />
    case 'checkbox':
      return <CheckSquare {...iconProps} />
    case 'dropdown':
    case 'multiple_choice':
      return <MoreHorizontal {...iconProps} />
    case 'score':
      return <Star {...iconProps} />
    default:
      return <MessageSquare {...iconProps} />
  }
}
