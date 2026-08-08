'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye, Pencil, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { CycleStatus, Question, Role } from '@/lib/api/types'
import {
  useApplicationTemplate,
  useUpdateApplicationTemplate,
} from '@/lib/queries/application-templates'
import {
  useDeleteQuestion,
  useQuestions,
  useReorderQuestions,
  useUpdateQuestion,
} from '@/lib/queries/questions'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { ROLE_CHIP_CLASS, ROLE_LABEL } from '@/lib/roles'
import { BlockPalette } from './BlockPalette'
import { QuestionCard } from './QuestionCard'
import { QuestionOutline } from './QuestionOutline'
import { LivePreview } from './LivePreview'
import { ReviewQuestionsBuilderClient } from './ReviewQuestionsBuilderClient'
import { TemplateTextBlock } from './TemplateTextBlock'
import { TEMPLATE_STATUS_LABEL, TEMPLATE_STATUS_ORDER } from './constants'

export function FormBuilderClient({
  cycleId,
  cycleName,
  role,
}: {
  cycleId: string
  cycleName: string
  role: Role
}) {
  const { data: questions = [] } = useQuestions(cycleId, role)
  const reorderQuestions = useReorderQuestions(cycleId, role)
  const updateQuestion = useUpdateQuestion()
  const deleteQuestion = useDeleteQuestion()
  const { data: reviewQuestions = [] } = useReviewQuestions(cycleId, role)

  const { data: template } = useApplicationTemplate(cycleId, role)
  const updateTemplate = useUpdateApplicationTemplate()

  const [mode, setMode] = useState<'application' | 'review'>('application')

  // Applications and reviews each get their own independent status/deadline
  // (review_status/review_closes_at are purely informational — unlike the
  // application's own closes_at, nothing enforces them; a lead can still
  // submit a review after the review deadline passes).
  const status =
    mode === 'application' ? template?.status : template?.review_status
  const closesAt =
    mode === 'application' ? template?.closes_at : template?.review_closes_at

  function changeStatus(next: CycleStatus) {
    if (!template || next === status) return
    updateTemplate.mutate({
      cycleId,
      role,
      body: mode === 'application' ? { status: next } : { review_status: next },
    })
  }

  function changeDeadline(date: Date) {
    if (!template) return
    updateTemplate.mutate({
      cycleId,
      role,
      body:
        mode === 'application'
          ? { closes_at: date.toISOString() }
          : { review_closes_at: date.toISOString() },
    })
  }

  // Mirrors the fetched list locally so drag reordering feels instant.
  // Resyncs during render (not an effect) whenever the query data changes
  // (create/delete/refetch) — see https://react.dev/learn/you-might-not-need-an-effect
  const [prevQuestions, setPrevQuestions] = useState(questions)
  const [order, setOrder] = useState<Question[]>(questions)
  if (questions !== prevQuestions) {
    setPrevQuestions(questions)
    setOrder(questions)
  }

  const [showPreview, setShowPreview] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = order.findIndex((q) => q.id === active.id)
    const newIndex = order.findIndex((q) => q.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const previous = order
    const reordered = arrayMove(order, oldIndex, newIndex)
    setOrder(reordered)

    reorderQuestions.mutate(
      { ordered: reordered },
      {
        // Roll the visible order back if persistence fails; the query cache is
        // rolled back by the mutation itself.
        onError: () => setOrder(previous),
      }
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b-2 border-gray-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-6">
        <div className="flex flex-col gap-2">
          <Link
            href="/admin/applications"
            className="text-text-subtle hover:text-text-default flex items-center gap-1.5 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Applications
          </Link>
          <h1 className="text-text-default text-xl font-semibold">
            {cycleName}
          </h1>
          <span
            className={cn(
              'w-fit rounded-md px-3 py-1.5 text-sm font-medium',
              ROLE_CHIP_CLASS[role]
            )}
          >
            {ROLE_LABEL[role]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setMode('application')}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                mode === 'application'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Application questions
            </button>
            <button
              type="button"
              onClick={() => setMode('review')}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                mode === 'review'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Review questions
            </button>
          </div>

          {template && status && (
            <>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium whitespace-nowrap text-gray-600">
                  {mode === 'application' ? 'Status' : 'Review status'}
                </span>
                <Select value={status} onValueChange={changeStatus}>
                  <SelectTrigger className="h-8 w-32 px-2.5 py-1.5 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {TEMPLATE_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Clock className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium whitespace-nowrap text-gray-600">
                  {mode === 'application' ? 'Deadline' : 'Review deadline'}
                </span>
                <DateTimePicker
                  value={closesAt ? new Date(closesAt) : undefined}
                  onValueChange={changeDeadline}
                  placeholder="Set deadline"
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="text-text-secondary border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 items-center gap-2 rounded-lg border bg-transparent px-2.5 py-1.5 text-sm font-medium transition-all hover:border-gray-300 focus-visible:ring-3"
          >
            {showPreview ? (
              <>
                <Pencil className="h-5 w-5" />
                Edit
              </>
            ) : (
              <>
                <Eye className="h-5 w-5" />
                Preview
              </>
            )}
          </button>
        </div>
      </div>

      {mode === 'review' && showPreview ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-10">
          <div className="mx-auto max-w-2xl">
            <LivePreview
              kind="review"
              cycleName={cycleName}
              role={role}
              questions={reviewQuestions}
            />
          </div>
        </div>
      ) : mode === 'review' ? (
        <ReviewQuestionsBuilderClient cycleId={cycleId} role={role} />
      ) : showPreview ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-10">
          <div className="mx-auto max-w-2xl">
            <LivePreview
              kind="application"
              cycleName={cycleName}
              role={role}
              questions={order}
              description={template?.description}
              instructions={template?.instructions}
            />
          </div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[280px_1fr] lg:overflow-hidden">
          <aside className="flex flex-col border-b border-gray-100 bg-white lg:overflow-y-auto lg:border-r lg:border-b-0">
            <div className="p-4">
              <BlockPalette
                cycleId={cycleId}
                role={role}
                nextOrder={order.length}
              />
            </div>
            <div className="flex-1 border-t border-gray-100 p-4">
              <QuestionOutline questions={order} />
            </div>
          </aside>

          <div className="overflow-y-auto bg-gray-50 p-10">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              <TemplateTextBlock
                cycleId={cycleId}
                role={role}
                field="description"
                label="Intro text — shown before the questions"
                placeholder="Add an introduction applicants will see before the questions…"
                value={template?.description}
              />

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={order.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-4">
                    {order.map((question, index) => (
                      <Fragment key={question.id}>
                        {index > 0 && question.page_title && (
                          <div className="flex items-center gap-3 pt-2">
                            <span className="text-text-subtle text-xs font-semibold tracking-wide uppercase">
                              {question.page_title}
                            </span>
                            <div className="h-px flex-1 bg-gray-200" />
                          </div>
                        )}
                        <QuestionCard
                          question={question}
                          onUpdate={(body) =>
                            updateQuestion.mutate({
                              id: question.id,
                              body,
                            })
                          }
                          onDelete={() =>
                            deleteQuestion.mutate({ id: question.id })
                          }
                        />
                      </Fragment>
                    ))}
                    {order.length === 0 && (
                      <p className="text-text-subtle mt-10 text-center text-sm">
                        Add a block from the left to start building this form.
                      </p>
                    )}
                  </div>
                </SortableContext>
              </DndContext>

              <TemplateTextBlock
                cycleId={cycleId}
                role={role}
                field="instructions"
                label="Closing text — shown after the questions"
                placeholder="Add submission instructions or closing notes applicants will see after the questions…"
                value={template?.instructions}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
