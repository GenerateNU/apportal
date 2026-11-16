'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { apiErrorDetail } from '@/lib/api/client'
import type { Cycle } from '@/lib/api/types'
import { useCycleStaff } from '@/lib/queries/cycle-staff'
import {
  useMeetingSlotMutations,
  useMeetingSlots,
  useStaffSlots,
} from '@/lib/queries/meeting-slots'
import { useStaffing } from '@/lib/queries/reviewer-pools'

export function MeetingTimes({ cycle }: { cycle: Cycle }) {
  const m = useMeetingSlotMutations(cycle.id)
  const toast = useToast()
  const { data: staff = [] } = useCycleStaff(cycle.id)
  const { data: staffing } = useStaffing(cycle.id)
  const { data: days = new Map<string, string>() } = useStaffSlots(cycle.id)
  const { data: slots = [] } = useMeetingSlots(cycle.id)
  const [label, setLabel] = useState('')
  const fail = (err: unknown) =>
    toast(apiErrorDetail(err), { variant: 'error' })

  function add() {
    const text = label.trim()
    if (!text) return
    m.create.mutateAsync(text).catch(fail)
    setLabel('')
  }

  const interviewers = new Set(
    (staffing?.positions ?? []).flatMap((p) => p.interviewers ?? [])
  )
  const people = staff
    .filter((p) => interviewers.has(p.user_nuid))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <Card className="flex flex-col gap-4">
      <label className="flex cursor-pointer items-start gap-2.5">
        <Checkbox
          className="mt-0.5"
          checked={cycle.match_by_slot}
          disabled={m.setMatching.isPending}
          onCheckedChange={(v) =>
            m.setMatching.mutateAsync(v === true).catch(fail)
          }
        />
        <span className="flex flex-col">
          <span className="text-ink text-sm font-medium">
            Match interviewers by meeting time
          </span>
          <span className="text-text-muted text-xs">
            Applicants pick the times they can make, and auto-assign pairs them
            with an interviewer from one of those times.
          </span>
        </span>
      </label>

      {cycle.match_by_slot && (
        <>
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <span className="text-text-muted text-xs">Times</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {slots.map((s) => (
                <span
                  key={s.id}
                  className="text-ink flex items-center gap-1 border border-gray-200 px-2 py-1 text-xs"
                >
                  {s.label}
                  <button
                    type="button"
                    aria-label={`Remove ${s.label}`}
                    onClick={() => m.remove.mutateAsync(s.id).catch(fail)}
                    className="text-text-faint hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') add()
                }}
                onBlur={add}
                placeholder="Add a time, e.g. Tue 7:30–9 PM"
                className="placeholder:text-text-faint min-w-48 border border-dashed border-gray-300 px-2 py-1 text-xs outline-none focus:border-gray-400"
              />
            </div>
          </div>

          {slots.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
              <span className="text-text-muted text-xs">
                Each interviewer&apos;s meeting time
              </span>
              <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {people.map((p) => {
                  const day = days.get(p.user_nuid)
                  const known = slots.some((s) => s.id === day)
                  return (
                    <div
                      key={p.user_nuid}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-ink truncate">{p.full_name}</span>
                      <Select
                        value={known ? day : 'none'}
                        onValueChange={(v) =>
                          m.setStaff
                            .mutateAsync({
                              nuid: p.user_nuid,
                              slotId: v === 'none' ? null : v,
                            })
                            .catch((err) =>
                              toast(apiErrorDetail(err), { variant: 'error' })
                            )
                        }
                      >
                        <SelectTrigger
                          className="h-7 w-40 text-xs"
                          aria-label={`${p.full_name}'s meeting time`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not set</SelectItem>
                          {slots.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
