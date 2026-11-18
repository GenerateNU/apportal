'use client'

import { SaveStatusLabel, SaveTrackerProvider, useSave } from './SaveTracker'
import { Fragment, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { statusBlockedReason } from '../lib/status'
import { Button } from '@/components/ui/button'
import { StatusDot } from '@/components/ui/badge'
import { cycleStatusDot } from '@/app/(portal)/admin/applications/components/constants'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
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
import type { CycleStatus, Question } from '@/lib/api/types'
import { useApplicationTemplate } from '@/lib/queries/application-templates'
import { useSetOpeningStep } from '@/lib/queries/workflow'
import {
  useDeleteQuestion,
  useQuestions,
  useReorderQuestions,
  useUpdateQuestion,
} from '@/lib/queries/questions'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { BlockPalette } from './BlockPalette'
import { QuestionCard } from './QuestionCard'
import { QuestionOutline } from './QuestionOutline'
import { LivePreview } from './LivePreview'
import { ReviewQuestionsBuilderClient } from './ReviewQuestionsBuilderClient'
import { TemplateTextBlock } from './TemplateTextBlock'
import { TEMPLATE_STATUS_LABEL, TEMPLATE_STATUS_ORDER } from './constants'
import { useRoleLookup } from '@/lib/queries/roles'
import { useCycle } from '@/lib/queries/cycles'

function FormBuilder({
  cycleId,
  cycleName,
  role,
  back: backOverride,
}: {
  cycleId: string
  cycleName: string
  role: string
  back?: React.ReactNode
}) {
  const { roleLabel, roleChipClass } = useRoleLookup()
  const { data: questions = [] } = useQuestions(cycleId, role)
  const reorderQuestions = useReorderQuestions(cycleId, role)
  const updateQuestion = useUpdateQuestion()
  const deleteQuestion = useDeleteQuestion()
  const { data: reviewQuestions = [], isLoading: reviewQuestionsLoading } =
    useReviewQuestions(cycleId, role)

  const { data: template } = useApplicationTemplate(cycleId, role)
  const setOpeningStep = useSetOpeningStep()
  const save = useSave()
  const { data: cycle } = useCycle(cycleId)
  // The backend refuses every edit once a cycle closes.
  const readOnly = cycle?.status === 'closed' || cycle?.status === 'archived'

  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const only =
    from === 'forms' ? 'application' : from === 'review-forms' ? 'review' : null
  const back =
    backOverride ??
    (only ? (
      <Breadcrumbs
        items={[
          only === 'review'
            ? { label: 'Review forms', href: '/reviewer/cycle/review-forms' }
            : {
                label: 'Application forms',
                href: '/reviewer/cycle/application',
              },
          { label: roleLabel(role) },
        ]}
      />
    ) : (
      <Breadcrumbs
        items={[
          { label: 'Branches', href: '/admin/branches' },
          { label: roleLabel(role) },
        ]}
      />
    ))
  const [mode, setMode] = useState<'application' | 'review'>(
    only ?? (searchParams.get('tab') === 'review' ? 'review' : 'application')
  )

  // Each side's status and deadline are its workflow step's release and deadline.
  const status =
    mode === 'application' ? template?.status : template?.review_status
  const closesAt =
    mode === 'application' ? template?.closes_at : template?.review_closes_at

  const step = mode === 'application' ? 'applications' : 'reviews'

  function changeStatus(next: CycleStatus) {
    if (!template || next === status) return
    save(setOpeningStep, { cycleId, roleId: role, step, status: next })
  }

  function changeDeadline(date: Date) {
    if (!template) return
    save(setOpeningStep, {
      cycleId,
      roleId: role,
      step,
      dueAt: date.toISOString(),
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
    // Distance threshold lets taps and touch-scrolls through the handle work.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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

    save(
      reorderQuestions,
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
      <PageHeader
        size="md"
        className="border-b-2 border-gray-100 p-4 sm:px-8 sm:pt-8 sm:pb-6"
        back={back}
        title={cycleName}
        subtitle={
          <span
            className={cn(
              'mt-1 inline-block w-fit px-3 py-1.5 text-sm font-medium',
              roleChipClass(role)
            )}
          >
            {roleLabel(role)}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!only && (
              <SegmentedTabs
                tabs={[
                  { id: 'application', label: 'Application questions' },
                  { id: 'review', label: 'Review questions' },
                ]}
                value={mode}
                onChange={setMode}
              />
            )}

            {template && status && (
              <fieldset disabled={readOnly} className="contents">
                <Select value={status} onValueChange={changeStatus}>
                  <SelectTrigger
                    aria-label="Status"
                    className="h-8 w-auto gap-2 px-3 text-sm"
                  >
                    <StatusDot className={cycleStatusDot[status]} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_STATUS_ORDER.map((s) => {
                      const blocked = statusBlockedReason(
                        mode,
                        s,
                        template.status,
                        {
                          hasQuestions: questions.length > 0,
                          hasDeadline: !!closesAt,
                        }
                      )
                      return (
                        <SelectItem key={s} value={s} disabled={!!blocked}>
                          {blocked
                            ? `${TEMPLATE_STATUS_LABEL[s]} (${blocked.toLowerCase()})`
                            : TEMPLATE_STATUS_LABEL[s]}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <DateTimePicker
                  value={closesAt ? new Date(closesAt) : undefined}
                  onValueChange={changeDeadline}
                  placeholder="Set deadline"
                  className="h-8 max-w-60 truncate px-3"
                />
              </fieldset>
            )}

            <span aria-hidden className="h-5 w-px bg-gray-200" />

            <Button
              variant="outline"
              onClick={() => setShowPreview((prev) => !prev)}
            >
              {showPreview ? <Pencil /> : <Eye />}
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
        }
      />

      {readOnly && (
        <p className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm text-gray-600 sm:px-8">
          This cycle is closed, so its forms can’t be edited.
        </p>
      )}

      {mode === 'review' && reviewQuestionsLoading ? (
        <div className="flex-1 p-4 sm:p-10">
          <LoadingText className="mx-auto max-w-2xl" />
        </div>
      ) : mode === 'review' && showPreview ? (
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
        <fieldset disabled={readOnly} className="contents">
          <ReviewQuestionsBuilderClient cycleId={cycleId} role={role} />
        </fieldset>
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
        <fieldset disabled={readOnly} className="contents">
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

            <div className="overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-10">
              <div className="pointer-events-none sticky top-0 z-10 -mb-6 flex justify-end">
                <SaveStatusLabel />
              </div>
              <div className="mx-auto flex max-w-2xl flex-col gap-4">
                <TemplateTextBlock
                  cycleId={cycleId}
                  role={role}
                  field="description"
                  label="Intro text, shown before the questions"
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
                              <SectionLabel as="span">
                                {question.page_title}
                              </SectionLabel>
                              <div className="h-px flex-1 bg-gray-200" />
                            </div>
                          )}
                          <QuestionCard
                            question={question}
                            onUpdate={(body) =>
                              save(updateQuestion, {
                                id: question.id,
                                body,
                              })
                            }
                            onDelete={() =>
                              save(deleteQuestion, { id: question.id })
                            }
                          />
                        </Fragment>
                      ))}
                      {order.length === 0 && (
                        <BlockPalette
                          cycleId={cycleId}
                          role={role}
                          nextOrder={0}
                          variant="start"
                          title="Start your application form"
                          hint="Pick the first question applicants will answer. You can reorder and edit everything after."
                        />
                      )}
                    </div>
                  </SortableContext>
                </DndContext>

                <TemplateTextBlock
                  cycleId={cycleId}
                  role={role}
                  field="instructions"
                  label="Closing text, shown after the questions"
                  placeholder="Add submission instructions or closing notes applicants will see after the questions…"
                  value={template?.instructions}
                />
              </div>
            </div>
          </div>
        </fieldset>
      )}
    </div>
  )
}

export function FormBuilderClient(
  props: React.ComponentProps<typeof FormBuilder>
) {
  return (
    <SaveTrackerProvider>
      <FormBuilder {...props} />
    </SaveTrackerProvider>
  )
}
