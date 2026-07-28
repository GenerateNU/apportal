'use client'

import { useState } from 'react'
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
import type { ReviewQuestion, Role } from '@/lib/api/types'
import {
  useDeleteReviewQuestion,
  useReorderReviewQuestions,
  useReviewQuestions,
  useUpdateReviewQuestion,
} from '@/lib/queries/review-questions'
import { QuestionCard } from './QuestionCard'
import { QuestionOutline } from './QuestionOutline'
import { ReviewBlockPalette } from './ReviewBlockPalette'

// The rubric a lead fills out when reviewing an application — same editing
// UI as the application-questions builder (drag-reorder QuestionCards + a
// palette to add new ones), minus the template/status/deadline/live-preview
// concepts that only make sense for the applicant-facing form, and minus
// page breaks (review forms are a single short list).
export function ReviewQuestionsBuilderClient({
  cycleId,
  role,
}: {
  cycleId: string
  role: Role
}) {
  const { data: questions = [] } = useReviewQuestions(cycleId, role)
  const updateReviewQuestion = useUpdateReviewQuestion()
  const deleteReviewQuestion = useDeleteReviewQuestion()
  const reorderReviewQuestions = useReorderReviewQuestions(cycleId, role)

  // Mirrors the fetched list locally so drag reordering feels instant —
  // same render-time resync pattern as FormBuilderClient's `order` state.
  const [prevQuestions, setPrevQuestions] = useState(questions)
  const [order, setOrder] = useState<ReviewQuestion[]>(questions)
  if (questions !== prevQuestions) {
    setPrevQuestions(questions)
    setOrder(questions)
  }

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

    reorderReviewQuestions.mutate(
      { ordered: reordered },
      { onError: () => setOrder(previous) }
    )
  }

  return (
    <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[280px_1fr] lg:overflow-hidden">
      <aside className="flex flex-col border-b border-gray-100 bg-white lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="p-4">
          <ReviewBlockPalette
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
                {order.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    allowPageBreak={false}
                    onUpdate={(body) =>
                      updateReviewQuestion.mutate({
                        id: question.id,
                        body: {
                          question_text: body.question_text,
                          is_required: body.is_required,
                          options: body.options,
                        },
                      })
                    }
                    onDelete={() =>
                      deleteReviewQuestion.mutate({ id: question.id })
                    }
                  />
                ))}
                {order.length === 0 && (
                  <p className="text-text-subtle mt-10 text-center text-sm">
                    Add a block from the left to start building this rubric.
                  </p>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  )
}
