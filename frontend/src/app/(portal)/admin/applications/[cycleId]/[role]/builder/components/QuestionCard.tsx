'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, X } from 'lucide-react'
import type { Question } from '@/lib/api/types'
import { useDeleteQuestion, useUpdateQuestion } from '@/lib/queries/questions'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
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

  const [text, setText] = useState(question.question_text)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const meta = QUESTION_TYPE_META[question.question_type]
  const Icon = meta.icon
  const options = question.options ?? []

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
        opts: { actor: REVIEWER_ACTOR },
      })
    }
  }

  function toggleRequired() {
    updateQuestion.mutate({
      id: question.id,
      body: { is_required: !question.is_required },
      opts: { actor: REVIEWER_ACTOR },
    })
  }

  function commitOptions(next: string[]) {
    updateQuestion.mutate({
      id: question.id,
      body: { options: next },
      opts: { actor: REVIEWER_ACTOR },
    })
  }

  function addOption() {
    commitOptions([...options, `Option ${options.length + 1}`])
  }

  function removeOption(index: number) {
    if (options.length <= 1) return
    commitOptions(options.filter((_, i) => i !== index))
  }

  function editOption(index: number, value: string) {
    const next = [...options]
    next[index] = value
    commitOptions(next)
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    deleteQuestion.mutate({ id: question.id, opts: { actor: REVIEWER_ACTOR } })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="text-text-faint hover:text-text-subtle mt-1 cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex flex-1 flex-col gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commitText}
            placeholder="Untitled question"
            className="text-text-default w-full rounded-md border border-transparent px-1 py-0.5 text-base font-medium outline-none hover:border-gray-200 focus:border-gray-300"
          />

          {meta.hasOptions && (
            <div className="flex flex-col gap-1.5">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span
                    className={
                      question.question_type === 'checkbox'
                        ? 'h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-300'
                        : 'h-3.5 w-3.5 shrink-0 rounded-full border border-gray-300'
                    }
                  />
                  <input
                    value={option}
                    onChange={(event) => editOption(index, event.target.value)}
                    className="text-text-secondary w-full rounded-md border border-transparent px-1 py-0.5 text-sm outline-none hover:border-gray-200 focus:border-gray-300"
                  />
                  <button
                    type="button"
                    aria-label="Remove option"
                    onClick={() => removeOption(index)}
                    disabled={options.length <= 1}
                    className="text-text-faint hover:text-text-subtle disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addOption}
                className="text-text-subtle hover:text-text-secondary flex items-center gap-1 self-start px-1 text-xs"
              >
                <Plus className="h-3 w-3" />
                Add option
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="text-text-subtle -mx-4 mt-3 flex items-center justify-between border-t border-gray-200 px-4 pt-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
          {question.role === null && (
            <span className="bg-chip-8-bg text-chip-8-text rounded-md px-1.5 py-0.5 text-[10px] font-medium">
              All roles
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={question.is_required}
              onChange={toggleRequired}
              className="accent-brand-blue h-3.5 w-3.5"
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
                ? 'rounded-md p-1 text-red-600 hover:bg-red-50'
                : 'text-text-faint hover:text-text-subtle rounded-md p-1 hover:bg-gray-100'
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
