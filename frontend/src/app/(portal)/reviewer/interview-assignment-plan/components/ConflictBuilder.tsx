'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type DraftConflict = { leadNuid: string; applicationId: string }

type Lead = { nuid: string; full_name: string }
type Applicant = { application_id: string; full_name: string }

// A conflict of interest is a hard exclusion, not a preference: the declared
// lead is never assigned to interview or review that applicant, even if it
// leaves them unassigned. Re-declared each planning run, same as meeting
// days — nothing here is persisted.
export function ConflictBuilder({
  leads,
  applicants,
  value,
  onChange,
}: {
  leads: Lead[]
  applicants: Applicant[]
  value: DraftConflict[]
  onChange: (value: DraftConflict[]) => void
}) {
  const [leadNuid, setLeadNuid] = useState('')
  const [applicationId, setApplicationId] = useState('')

  const nameOfLead = (nuid: string) =>
    leads.find((l) => l.nuid === nuid)?.full_name ?? nuid
  const nameOfApplicant = (id: string) =>
    applicants.find((a) => a.application_id === id)?.full_name ?? id

  const alreadyDeclared = value.some(
    (c) => c.leadNuid === leadNuid && c.applicationId === applicationId
  )

  function add() {
    if (!leadNuid || !applicationId || alreadyDeclared) return
    onChange([...value, { leadNuid, applicationId }])
    setApplicationId('')
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-text-default text-sm font-semibold">
          Conflicts of interest
        </h2>
        <p className="text-text-muted mt-0.5 text-xs">
          A lead here is never assigned to interview or review that
          applicant&apos;s interview, even if no one else is available. Not
          saved; re-declare it each time you plan.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white p-4">
        <Select value={leadNuid} onValueChange={setLeadNuid}>
          <SelectTrigger className="h-8 w-48 text-xs" aria-label="Lead">
            <SelectValue placeholder="Select a lead…" />
          </SelectTrigger>
          <SelectContent>
            {leads.map((lead) => (
              <SelectItem key={lead.nuid} value={lead.nuid}>
                {lead.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-text-faint text-xs">cannot interview/review</span>
        <Select value={applicationId} onValueChange={setApplicationId}>
          <SelectTrigger className="h-8 w-56 text-xs" aria-label="Applicant">
            <SelectValue placeholder="Select an applicant…" />
          </SelectTrigger>
          <SelectContent>
            {applicants.map((applicant) => (
              <SelectItem
                key={applicant.application_id}
                value={applicant.application_id}
              >
                {applicant.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={add}
          disabled={!leadNuid || !applicationId || alreadyDeclared}
        >
          <Plus size={14} />
          Add conflict
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((conflict, i) => (
            <span
              key={`${conflict.leadNuid}-${conflict.applicationId}`}
              className="text-text-muted inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium"
            >
              {nameOfLead(conflict.leadNuid)} ⊘{' '}
              {nameOfApplicant(conflict.applicationId)}
              <button
                type="button"
                aria-label={`Remove conflict between ${nameOfLead(conflict.leadNuid)} and ${nameOfApplicant(conflict.applicationId)}`}
                className="hover:text-destructive"
                onClick={() => remove(i)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
