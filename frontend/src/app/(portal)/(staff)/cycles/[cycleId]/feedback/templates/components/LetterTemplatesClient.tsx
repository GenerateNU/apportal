'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PageSection } from '@/components/ui/page-section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useCycleRolePicker } from '@/hooks/useRoleSelection'
import type { DecisionKind, DecisionTemplate } from '@/lib/api/types'
import { useCycleScope } from '@/hooks/useCycleScope'
import { useIsChief } from '@/lib/queries/cycle-staff'
import {
  useDecisionTemplates,
  useUpdateDecisionTemplate,
} from '@/lib/queries/decisions'
import { KIND_DESCRIPTION, KIND_LABEL } from '../../components/constants'
import { useCycleHref } from '@/hooks/useCycleHref'

const KINDS: DecisionKind[] = ['rejection_post_interview', 'rejection_generic']

const PLACEHOLDERS = [
  ['{{applicant_name}}', 'first name'],
  ['{{branch}}', 'branch'],
  ['{{role}}', 'position'],
  ['{{cycle}}', 'cycle'],
  ['{{feedback}}', "interviewer's feedback"],
  ['{{compliments}}', 'what stood out'],
]

export function LetterTemplatesClient() {
  const toCycle = useCycleHref()
  const searchParams = useSearchParams()
  const { cycleId } = useCycleScope(useIsChief() ? 'chief' : 'lead')
  const { role, setRole, roleIds, roleLabel } = useCycleRolePicker(
    cycleId,
    searchParams.get('role')
  )
  const { data: templates = [], isLoading } = useDecisionTemplates(
    cycleId,
    role
  )

  return (
    <>
      <PageHeader
        back={
          <Breadcrumbs
            items={[
              { label: 'Feedback', href: toCycle('/cycle/feedback') },
              { label: 'Letter templates' },
            ]}
          />
        }
        title="Letter templates"
        subtitle="Every unsent letter is built from these, so a fix here fixes all of them."
        actions={
          roleIds.length > 1 && (
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9 w-52" aria-label="Position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleIds.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />

      <div className="text-text-muted flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        <span>You can use:</span>
        {PLACEHOLDERS.map(([token, meaning]) => (
          <span key={token}>
            <code className="bg-gray-100 px-1 py-0.5">{token}</code> {meaning}
          </span>
        ))}
      </div>

      {isLoading ? (
        <LoadingText />
      ) : (
        KINDS.map((kind) => {
          const template = templates.find((t) => t.kind === kind)
          return (
            <PageSection
              key={kind}
              label={KIND_LABEL[kind]}
              hint={KIND_DESCRIPTION[kind]}
            >
              {template && (
                <TemplateForm
                  key={template.id}
                  cycleId={cycleId}
                  role={role}
                  template={template}
                />
              )}
            </PageSection>
          )
        })
      )}
    </>
  )
}

function TemplateForm({
  cycleId,
  role,
  template,
}: {
  cycleId: string
  role: string
  template: DecisionTemplate
}) {
  const toast = useToast()
  const update = useUpdateDecisionTemplate(cycleId, role)
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body)
  const changed = subject !== template.subject || body !== template.body

  function save() {
    update.mutate(
      { kind: template.kind, subject: subject.trim(), body: body.trim() },
      {
        onSuccess: () => toast('Letter saved', { variant: 'success' }),
        onError: () => toast('Could not save the letter', { variant: 'error' }),
      }
    )
  }

  return (
    <Card className="flex flex-col gap-4 sm:p-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-text-default text-sm font-medium">Subject</span>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-text-default text-sm font-medium">Body</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          className="focus:border-ink text-text-default w-full resize-y border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button
          onClick={save}
          disabled={
            !changed || update.isPending || !subject.trim() || !body.trim()
          }
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
        {changed && (
          <Button
            variant="ghost"
            onClick={() => {
              setSubject(template.subject)
              setBody(template.body)
            }}
          >
            Discard changes
          </Button>
        )}
      </div>
    </Card>
  )
}
