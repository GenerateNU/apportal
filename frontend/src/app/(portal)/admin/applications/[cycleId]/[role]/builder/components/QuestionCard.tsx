'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, X } from 'lucide-react'
import type { Question } from '@/lib/api/types'
import { useDeleteQuestion, useUpdateQuestion } from '@/lib/queries/questions'
import { QUESTION_TYPE_META } from './constants'

export function QuestionCard({ question }: { question: Question }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })
  const updateQuestion = useUpdateQuestion()
  const deleteQuestion = useDeleteQuestion()

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Seed the editable fields from props, then resync during render whenever the
  // persisted value changes (e.g. after an edit invalidates the list and it
  // refetches) so the card never shows stale text/options. Comparing options by
  // value — not array identity — avoids clobbering in-progress edits on refetches
  // that returned the same content with a fresh array reference.
  // https://react.dev/learn/you-might-not-need-an-effect
  const persistedOptions = question.options ?? []
  // Single-line inputs never contain a newline, so this is a collision-safe join.
  const persistedOptionsKey = persistedOptions.join('\n')

  const [prevText, setPrevText] = useState(question.question_text)
  const [text, setText] = useState(question.question_text)
  if (question.question_text !== prevText) {
    setPrevText(question.question_text)
    setText(question.question_text)
  }

  const [prevOptionsKey, setPrevOptionsKey] = useState(persistedOptionsKey)
  const [options, setOptions] = useState(persistedOptions)
  if (persistedOptionsKey !== prevOptionsKey) {
    setPrevOptionsKey(persistedOptionsKey)
    setOptions(persistedOptions)
  }

  const [prevPageTitle, setPrevPageTitle] = useState(question.page_title ?? '')
  const [pageTitleDraft, setPageTitleDraft] = useState(
    question.page_title ?? ''
  )
  if ((question.page_title ?? '') !== prevPageTitle) {
    setPrevPageTitle(question.page_title ?? '')
    setPageTitleDraft(question.page_title ?? '')
  }
  const hasPageBreak = question.page_title != null
  // Global questions (role === null) are shared across every role's form at
  // potentially different relative positions, so a page boundary on one
  // wouldn't mean the same thing for another — only role-specific questions
  // can start a page.
  const canHavePageBreak = question.role !== null

  const meta = QUESTION_TYPE_META[question.question_type]
  const Icon = meta.icon

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function commitText() {
    const trimmed = text.trim()
    if (!trimmed) {
      setText(question.question_text)
      return
    }
    if (trimmed !== question.question_text) {
      updateQuestion.mutate({
        id: question.id,
        body: { question_text: trimmed },
      })
    }
  }

  function toggleRequired() {
    updateQuestion.mutate({
      id: question.id,
      body: { is_required: !question.is_required },
    })
  }

  function commitOptions(next: string[]) {
    updateQuestion.mutate({
      id: question.id,
      body: { options: next },
    })
  }

  function addOption() {
    const next = [...options, `Option ${options.length + 1}`]
    setOptions(next)
    commitOptions(next)
  }

  function removeOption(index: number) {
    if (options.length <= 1) return
    const next = options.filter((_, i) => i !== index)
    setOptions(next)
    commitOptions(next)
  }

  function editOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  }

  function commitOptionsOnBlur() {
    const persisted = question.options ?? []
    const changed =
      options.length !== persisted.length ||
      options.some((o, i) => o !== persisted[i])
    if (changed) {
      commitOptions(options)
    }
  }

  function togglePageBreak() {
    if (hasPageBreak) {
      updateQuestion.mutate({
        id: question.id,
        body: { clear_page_title: true },
      })
      return
    }
    const title = pageTitleDraft.trim() || 'Untitled page'
    setPageTitleDraft(title)
    updateQuestion.mutate({ id: question.id, body: { page_title: title } })
  }

  function commitPageTitle() {
    const trimmed = pageTitleDraft.trim()
    if (!trimmed) {
      setPageTitleDraft(question.page_title ?? '')
      return
    }
    if (trimmed !== question.page_title) {
      updateQuestion.mutate({ id: question.id, body: { page_title: trimmed } })
    }
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    deleteQuestion.mutate({ id: question.id })
  }

  return (
    <div
      id={`question-${question.id}`}
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="text-text-faint hover:text-text-subtle mt-1 cursor-grab touch-none rounded-md p-1 hover:bg-gray-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex flex-1 flex-col gap-3">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commitText}
            placeholder="Untitled question"
            className="text-text-default w-full rounded-md border border-transparent px-1.5 py-1 text-lg font-medium outline-none hover:border-gray-200 focus:border-gray-300"
          />

          {canHavePageBreak && (
            <div className="flex items-center gap-2">
              <label className="text-text-subtle flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={hasPageBreak}
                  onChange={togglePageBreak}
                  className="accent-brand-blue h-3.5 w-3.5"
                />
                Start a new page here
              </label>
              {hasPageBreak && (
                <input
                  aria-label="Page title"
                  value={pageTitleDraft}
                  onChange={(event) => setPageTitleDraft(event.target.value)}
                  onBlur={commitPageTitle}
                  placeholder="Page title"
                  className="text-text-secondary rounded-md border border-transparent px-1.5 py-0.5 text-sm outline-none hover:border-gray-200 focus:border-gray-300"
                />
              )}
            </div>
          )}

          {meta.hasOptions && (
            <div className="flex flex-col gap-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  {question.question_type !== 'dropdown' && (
                    <span
                      className={
                        question.question_type === 'checkbox'
                          ? 'h-4 w-4 shrink-0 rounded-sm border border-gray-300'
                          : 'h-4 w-4 shrink-0 rounded-full border border-gray-300'
                      }
                    />
                  )}
                  <input
                    aria-label={`Option ${index + 1}`}
                    value={option}
                    onChange={(event) => editOption(index, event.target.value)}
                    onBlur={commitOptionsOnBlur}
                    className="text-text-secondary w-full rounded-md border border-transparent px-1.5 py-1 text-base outline-none hover:border-gray-200 focus:border-gray-300"
                  />
                  <button
                    type="button"
                    aria-label="Remove option"
                    onClick={() => removeOption(index)}
                    disabled={options.length <= 1}
                    className="text-text-faint hover:text-text-subtle rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-40"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addOption}
                className="text-text-subtle hover:text-text-secondary flex items-center gap-1.5 self-start rounded-md px-2 py-1.5 text-base hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" />
                Add option
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="text-text-subtle -mx-6 mt-4 flex items-center justify-between border-t border-gray-200 px-6 pt-3 text-base">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {meta.label}
          </span>
          {question.role === null && (
            <span className="bg-chip-8-bg text-chip-8-text rounded-md px-2 py-1 text-sm font-medium">
              All roles
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {confirmingDelete && hasPageBreak && (
            <span className="max-w-xs text-xs text-red-600">
              This question starts a page (&quot;{question.page_title}&quot;) —
              deleting it will merge this page into the previous one.
            </span>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={question.is_required}
              onChange={toggleRequired}
              className="accent-brand-blue h-4 w-4"
            />
            Required
          </label>
          <button
            type="button"
            aria-label={confirmingDelete ? 'Confirm delete' : 'Delete question'}
            onClick={handleDelete}
            onBlur={() => setConfirmingDelete(false)}
            className={
              confirmingDelete
                ? 'rounded-md p-1.5 text-red-600 hover:bg-red-50'
                : 'text-text-faint hover:text-text-subtle rounded-md p-1.5 hover:bg-gray-100'
            }
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
