'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  X,
  Type,
  Link,
  CheckSquare,
  MoreHorizontal,
  Star,
  Calendar,
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
import type { Question, QuestionType } from '@/lib/api/types'

type FilterValue = string | { options: string[] }

export interface AnswerFilter {
  question_id: string
  question_text: string
  question_type: QuestionType
  values: FilterValue
}

interface FilterChipsProps {
  filters: AnswerFilter[]
  columns: Question[]
  onFilterChange: (
    filter: AnswerFilter | null,
    action: 'add' | 'remove'
  ) => void
}

export function FilterChips({
  filters,
  columns,
  onFilterChange,
}: FilterChipsProps) {
  // Check for duplicate question IDs
  const questionIds = columns.map(q => q.id)
  const duplicates = questionIds.filter((id, idx) => questionIds.indexOf(id) !== idx)
  if (duplicates.length > 0) {
    console.warn('Duplicate question IDs found:', duplicates)
  }

  const [isOpen, setIsOpen] = useState(false)
  const [filterValues, setFilterValues] = useState<Record<string, FilterValue>>({})
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

  const filterableColumns = columns

  const availableColumns = filterableColumns.filter(
    (q) => !filters.some((f) => f.question_id === q.id)
  )

  const filteredColumns = availableColumns.filter((q) =>
    q.question_text.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getDisplayValue = (filter: AnswerFilter): string => {
    if (typeof filter.values === 'string') {
      return filter.values
    } else if (
      typeof filter.values === 'object' &&
      'options' in filter.values
    ) {
      return filter.values.options.join(', ')
    }
    return ''
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        const middleText =
          ['short_answer', 'long_answer', 'url'].includes(filter.question_type)
            ? 'contains'
            : 'is'
        return (
          <div
            key={filter.question_id}
            className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 w-40">
              <span className="text-text-default truncate text-sm">
                {filter.question_text}
              </span>
            </div>
            <div className="border-l border-gray-200 px-2 py-1.5 w-20 flex justify-center">
              <span className="text-text-muted text-sm">{middleText}</span>
            </div>
            <div className="flex items-center gap-2 border-l border-gray-200 px-3 py-1.5 w-40">
              <span className="text-text-default truncate text-sm">
                {getDisplayValue(filter)}
              </span>
              <button
                onClick={() => onFilterChange(filter, 'remove')}
                className="text-text-muted hover:text-text-default shrink-0 transition-colors"
                title="Remove filter"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      })}

      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            onClick={() => {
              setActiveQuestionId(null)
              setFilterValues({})
              setSearchTerm('')
            }}
            className="text-text-muted inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-50"
            title="Add filter"
          >
            <Plus className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-72 overflow-visible p-0"
          onKeyDown={(e) => {
            // Prevent dropdown navigation keys except when in inputs
            const target = e.target as HTMLElement
            if (target.tagName !== 'INPUT' && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
              e.preventDefault()
            }
          }}
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
                      {getIconForQuestionType(q.question_type)}
                      <div className="min-w-0 flex-1">
                        <div className="text-text-default truncate text-sm font-medium">
                          {q.question_text}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-72 p-0">
                    <div className="border-b border-gray-200 px-2 py-1.5">
                      <div className="text-text-default truncate text-xs font-medium">
                        {q.question_text}
                      </div>
                    </div>
                    <div className="px-2 py-1.5">
                      {q.question_type === 'checkbox' ||
                      q.question_type === 'dropdown' ? (
                        <div className="max-h-56 space-y-2 overflow-y-auto">
                          {getOptionsForQuestion(q).map((option) => {
                            const currentValue = filterValues[q.id]
                            const isChecked =
                              typeof currentValue === 'object' &&
                              'options' in currentValue &&
                              currentValue.options.includes(option)
                            const checkboxId = `filter-${q.id}-${option}`
                            return (
                              <div key={option} className="flex items-center gap-2">
                                <Checkbox
                                  id={checkboxId}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const current =
                                      typeof filterValues[q.id] === 'object' &&
                                      'options' in filterValues[q.id]
                                        ? [...filterValues[q.id].options]
                                        : []
                                    if (checked && !current.includes(option)) {
                                      current.push(option)
                                    } else {
                                      const idx = current.indexOf(option)
                                      if (idx > -1) current.splice(idx, 1)
                                    }
                                    setFilterValues({
                                      ...filterValues,
                                      [q.id]: { options: current },
                                    })
                                  }}
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
                            data-question-id={q.id}
                            value={
                              typeof filterValues[q.id] === 'string'
                                ? filterValues[q.id]
                                : ''
                            }
                            onChange={(e) => {
                              if (activeQuestionId !== q.id) {
                                setActiveQuestionId(q.id)
                              }
                              setFilterValues({
                                ...filterValues,
                                [q.id]: e.target.value,
                              })
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') {
                                const value = filterValues[q.id]
                                if (value) {
                                  onFilterChange(
                                    {
                                      question_id: q.id,
                                      question_text: q.question_text,
                                      question_type: q.question_type,
                                      values: value,
                                    },
                                    'add'
                                  )
                                  setIsOpen(false)
                                  setActiveQuestionId(null)
                                  setFilterValues({ ...filterValues, [q.id]: undefined })
                                }
                              }
                            }}
                            autoFocus
                            className="h-6 flex-1 border-0 px-2 !text-xs outline-none focus:ring-0 focus:outline-none focus-visible:ring-0"
                          />
                          <button
                            onClick={() => {
                              const value = filterValues[q.id]
                              if (value) {
                                onFilterChange(
                                  {
                                    question_id: q.id,
                                    question_text: q.question_text,
                                    question_type: q.question_type,
                                    values: value,
                                  },
                                  'add'
                                )
                                setIsOpen(false)
                                setActiveQuestionId(null)
                                setFilterValues({ ...filterValues, [q.id]: undefined })
                              }
                            }}
                            disabled={!filterValues[q.id]}
                            className="bg-gray-100 hover:bg-gray-200 text-text-muted hover:text-text-default shrink-0 rounded px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {(q.question_type === 'checkbox' || q.question_type === 'dropdown') && (
                      <div className="flex border-t border-gray-200 px-2 py-1">
                        <button
                          onClick={() => {
                            const value = filterValues[q.id]
                            if (value) {
                              onFilterChange(
                                {
                                  question_id: q.id,
                                  question_text: q.question_text,
                                  question_type: q.question_type,
                                  values: value,
                                },
                                'add'
                              )
                              setIsOpen(false)
                              setActiveQuestionId(null)
                              setFilterValues({ ...filterValues, [q.id]: undefined })
                            }
                          }}
                          disabled={!filterValues[q.id]}
                          className="bg-text-default hover:bg-text-emphasis w-full rounded px-2 py-0.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    )}
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

function getOptionsForQuestion(question: Question): string[] {
  if (
    question.question_type === 'checkbox' ||
    question.question_type === 'dropdown'
  ) {
    try {
      const parsed = JSON.parse(question.question_options || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function getIconForQuestionType(questionType: QuestionType): React.ReactNode {
  const iconProps = { className: 'h-4 w-4 text-text-muted shrink-0' }

  switch (questionType) {
    case 'text':
      return <Type {...iconProps} />
    case 'url':
      return <Link {...iconProps} />
    case 'checkbox':
      return <CheckSquare {...iconProps} />
    case 'dropdown':
      return <MoreHorizontal {...iconProps} />
    case 'rating':
      return <Star {...iconProps} />
    case 'date':
      return <Calendar {...iconProps} />
    default:
      return <MessageSquare {...iconProps} />
  }
}
