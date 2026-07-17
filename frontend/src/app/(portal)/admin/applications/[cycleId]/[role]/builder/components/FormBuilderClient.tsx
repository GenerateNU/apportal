'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import type { Question, Role } from '@/lib/api/types'
import { useQuestions, useReorderQuestions } from '@/lib/queries/questions'
import { ROLE_CHIP_CLASS, ROLE_LABEL } from '@/lib/roles'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { BlockPalette } from './BlockPalette'
import { QuestionCard } from './QuestionCard'
import { LivePreview } from './LivePreview'

export function FormBuilderClient({
  cycleId,
  cycleName,
  role,
}: {
  cycleId: string
  cycleName: string
  role: Role
}) {
  const { data: questions = [] } = useQuestions(cycleId, role, {
    actor: REVIEWER_ACTOR,
  })
  const reorderQuestions = useReorderQuestions(cycleId, role)

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
      { ordered: reordered, opts: { actor: REVIEWER_ACTOR } },
      {
        // Roll the visible order back if persistence fails; the query cache is
        // rolled back by the mutation itself.
        onError: () => setOrder(previous),
      }
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b-2 border-gray-100 px-8 py-6">
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

        <button
          type="button"
          onClick={() => setShowPreview((prev) => !prev)}
          className="text-text-secondary flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-base font-medium shadow-sm hover:bg-gray-50"
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

      {showPreview ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-10">
          <div className="mx-auto max-w-2xl">
            <LivePreview cycleName={cycleName} role={role} questions={order} />
          </div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-[280px_1fr] overflow-hidden">
          <div className="overflow-y-auto bg-gray-50 p-4">
            <BlockPalette
              cycleId={cycleId}
              role={role}
              nextOrder={order.length}
            />
          </div>

          <div className="overflow-y-auto bg-gray-50 p-10">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={order.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mx-auto flex max-w-2xl flex-col gap-4">
                  {order.map((question) => (
                    <QuestionCard key={question.id} question={question} />
                  ))}
                  {order.length === 0 && (
                    <p className="text-text-subtle mt-10 text-center text-sm">
                      Add a block from the left to start building this form.
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  )
}
