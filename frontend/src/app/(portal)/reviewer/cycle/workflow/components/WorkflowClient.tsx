'use client'

import { MeetingTimes } from '../../components/MeetingTimes'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Subheading } from '@/components/ui/subheading'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { useToast } from '@/components/ui/toast'
import { type CycleScope, useCycleScope } from '@/hooks/useCycleScope'
import { apiErrorDetail } from '@/lib/api/client'
import {
  perApplicant,
  type StepName,
  stepConfig,
  useCycleSteps,
  useWorkflowMutations,
} from '@/lib/queries/workflow'
import { useCreateRole, useDeleteRole } from '@/lib/queries/roles'
import { cn } from '@/lib/utils'
import { GroupsGrid, StaffingTable } from '../../components/PositionTeams'
import {
  PIPELINE_STEPS,
  RECORDING_SETTING,
  STEP_DESCRIPTION,
  STEP_LABEL,
  STEP_SETTING,
} from './stage-meta'

function SetupShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: (scope: CycleScope) => React.ReactNode
}) {
  const scope = useCycleScope()
  if (!scope.cycleId && !scope.isLoading) return <NoCycle />
  return (
    <div className={PAGE_SHELL}>
      <PageHeader title={title} subtitle={subtitle} />
      {!scope.cycleId ? <LoadingText /> : children(scope)}
    </div>
  )
}

const rolesOf = (scope: CycleScope) =>
  scope.roles.roleIds.map((id) => ({ id, name: scope.roles.roleLabel(id) }))

export function TeamClient() {
  return (
    <SetupShell
      title="Recruitment team"
      subtitle="Who's involved in recruitment, and which openings they handle."
    >
      {(scope) => (
        <>
          <GroupsGrid
            cycleId={scope.cycleId}
            header={
              <Subheading
                title="Groups"
                hint="Group chiefs and leads by what they're responsible for. Keep everyone in one group, or split into groups like Design Chiefs or Engineering TLs."
              />
            }
          />
          {scope.roles.roleIds.length > 0 && (
            <section className="flex flex-col gap-3">
              <Subheading
                title="Who reviews and interviews"
                hint="Choose which groups review and interview each opening. If none are picked, the whole team is included. Auto-assign uses this too."
              />
              <Card padding="none">
                <StaffingTable cycleId={scope.cycleId} roles={rolesOf(scope)} />
              </Card>
            </section>
          )}
          {scope.cycle && (
            <section className="flex flex-col gap-3">
              <Subheading
                title="Meeting times"
                hint="For teams that hire around weekly meetings."
              />
              <MeetingTimes cycle={scope.cycle} />
            </section>
          )}
        </>
      )}
    </SetupShell>
  )
}

export function WorkflowClient() {
  return (
    <SetupShell
      title="Openings & process"
      subtitle="What you're hiring for, and the steps applicants go through."
    >
      {(scope) => (
        <>
          <PositionsSection scope={scope} />
          <PipelineSection key={scope.cycleId} cycleId={scope.cycleId} />
        </>
      )}
    </SetupShell>
  )
}

function PositionsSection({ scope }: { scope: CycleScope }) {
  const createRole = useCreateRole()
  const deleteRole = useDeleteRole()
  const toast = useToast()
  const [name, setName] = useState('')

  async function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await createRole.mutateAsync({
        body: { cycle_id: scope.cycleId, name: trimmed },
      })
      setName('')
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function remove(id: string) {
    try {
      await deleteRole.mutateAsync({ id })
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <Subheading
        title="Positions"
        hint="Each position gets its own application, rubric and ranking."
      />
      <Card className="flex flex-wrap items-center gap-2">
        {scope.roles.isLoading && <Skeleton className="h-8 w-32" />}
        {scope.roles.roles.map((r) => (
          <span
            key={r.id}
            className="text-ink flex items-center gap-1 border border-gray-200 bg-gray-50 py-1 pr-1 pl-3 text-sm font-medium"
          >
            {r.name}
            <button
              type="button"
              aria-label={`Remove ${r.name}`}
              disabled={deleteRole.isPending}
              onClick={() => remove(r.id)}
              className="text-text-subtle hover:text-ink p-1 hover:bg-gray-200"
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <form
          className="flex items-center"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <span className="flex items-center gap-1.5 border border-dashed border-gray-300 px-2.5 py-1 focus-within:border-gray-500">
            <Plus size={13} className="text-text-subtle" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                scope.cycle?.application_type === 'lead'
                  ? 'e.g. Mechanical Lead'
                  : 'e.g. Mechanical Engineer'
              }
              aria-label="New position"
              disabled={createRole.isPending}
              className="placeholder:text-text-subtle w-36 bg-transparent text-sm outline-none"
            />
          </span>
        </form>
      </Card>
    </section>
  )
}

function PipelineSection({ cycleId }: { cycleId: string }) {
  const { data: steps = [], isLoading } = useCycleSteps(cycleId)
  const m = useWorkflowMutations(cycleId)
  const toast = useToast()
  const busy = m.setEnabled.isPending || m.setPerApplicant.isPending

  if (isLoading) return <LoadingText />

  let number = 0

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  function toggle(step: StepName, on: boolean) {
    run(async () => {
      await m.setEnabled.mutateAsync({ step, enabled: on })
      const setting = STEP_SETTING[step]
      if (on && setting && !perApplicant(steps, step, setting.kind))
        await m.setPerApplicant.mutateAsync({
          step,
          kind: setting.kind,
          perApplicant: setting.defaultCount,
        })
    })
  }

  const recording = perApplicant(steps, 'interviews', 'recording_reviewer')

  return (
    <section className="flex flex-col gap-3">
      <Subheading
        title="Workflow"
        hint="How your team wants to run this application cycle. Turn off anything you don't need."
      />
      <Card padding="none">
        <ol>
          {PIPELINE_STEPS.map((step, i) => {
            const on = !!stepConfig(steps, step)?.enabled
            if (on) number++
            const setting = STEP_SETTING[step]
            return (
              <StageRow
                key={step}
                step={step}
                count={setting ? perApplicant(steps, step, setting.kind) : 0}
                on={on}
                number={on ? number : undefined}
                last={i === PIPELINE_STEPS.length - 1}
                busy={busy}
                onToggle={(next) => toggle(step, next)}
                onSave={(n) =>
                  setting &&
                  run(() =>
                    m.setPerApplicant.mutateAsync({
                      step,
                      kind: setting.kind,
                      perApplicant: n,
                    })
                  )
                }
                extra={
                  step === 'interviews' && on ? (
                    <SubOption
                      label="Recording reviews"
                      hint="Someone who didn't interview watches the recording after"
                      count={recording}
                      unit={RECORDING_SETTING.unit}
                      busy={busy}
                      onChange={(n) =>
                        run(() =>
                          m.setPerApplicant.mutateAsync({
                            step: 'interviews',
                            kind: 'recording_reviewer',
                            perApplicant: n,
                          })
                        )
                      }
                    />
                  ) : undefined
                }
              />
            )
          })}
        </ol>
      </Card>
    </section>
  )
}

function StageRow({
  step,
  count: saved,
  on,
  number,
  last,
  busy,
  onToggle,
  onSave,
  extra,
}: {
  step: StepName
  count: number
  on: boolean
  number?: number
  last: boolean
  busy: boolean
  onToggle: (on: boolean) => void
  onSave: (n: number) => void
  extra?: React.ReactNode
}) {
  const setting = STEP_SETTING[step]
  const label = STEP_LABEL[step]
  const [count, setCount] = useState(
    String(saved || setting?.defaultCount || 0)
  )

  return (
    <li className="relative px-5 py-4">
      <div className="flex gap-4">
        {!last && (
          <span
            aria-hidden
            className="absolute top-11 bottom-0 left-[1.95rem] w-px bg-gray-200"
          />
        )}
        <span
          className={cn(
            'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
            on
              ? 'bg-ink text-white'
              : 'border border-dashed border-gray-300 bg-white text-transparent'
          )}
        >
          {number ?? '·'}
        </span>
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-wrap items-start gap-x-6 gap-y-2',
            !on && 'opacity-50'
          )}
        >
          <div className="flex min-w-0 flex-[1_1_16rem] flex-col">
            <span className="text-ink py-0.5 text-sm font-semibold">
              {label}
            </span>
            <span className="text-text-muted text-sm">
              {STEP_DESCRIPTION[step]}
            </span>
          </div>
          {setting && (
            <label className="text-text-muted flex items-center gap-2 text-sm">
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                disabled={!on}
                onChange={(e) => setCount(e.target.value)}
                onBlur={() => {
                  const n = Number(count)
                  if (Number.isInteger(n) && n >= 1 && n !== saved) onSave(n)
                }}
                className="text-ink w-12 border border-gray-200 px-2 py-1 text-center text-sm outline-none focus:border-gray-400"
              />
              {setting.unit}
            </label>
          )}
        </div>
        <Switch
          checked={on}
          disabled={busy}
          label={`Use ${label}`}
          onChange={onToggle}
        />
      </div>
      {extra && <div className="mt-3 ml-10">{extra}</div>}
    </li>
  )
}

function SubOption({
  label,
  hint,
  count: saved,
  unit,
  busy,
  onChange,
}: {
  label: string
  hint: string
  count: number
  unit: string
  busy: boolean
  onChange: (n: number | null) => void
}) {
  const on = saved > 0
  const [count, setCount] = useState(String(saved || 1))
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-100 pt-3">
      <span className={cn('flex min-w-0 flex-1 flex-col', !on && 'opacity-50')}>
        <span className="text-ink text-sm font-medium">{label}</span>
        <span className="text-text-muted text-xs">{hint}</span>
      </span>
      {on && (
        <label className="text-text-muted flex items-center gap-2 text-sm">
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            onBlur={() => {
              const n = Number(count)
              if (Number.isInteger(n) && n >= 1 && n !== saved) onChange(n)
            }}
            className="text-ink w-12 border border-gray-200 px-2 py-1 text-center text-sm outline-none focus:border-gray-400"
          />
          {unit}
        </label>
      )}
      <Switch
        checked={on}
        disabled={busy}
        label={`Use ${label}`}
        onChange={(next) =>
          onChange(
            next ? Number(count) || RECORDING_SETTING.defaultCount : null
          )
        }
      />
    </div>
  )
}

function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-ink' : 'bg-gray-300'
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

function NoCycle() {
  return (
    <div className={PAGE_SHELL}>
      <PageHeader title="Recruitment" />
      <EmptyState
        title="No recruitment to run yet"
        description="An admin opens a cycle and adds you as its chief."
      />
    </div>
  )
}
