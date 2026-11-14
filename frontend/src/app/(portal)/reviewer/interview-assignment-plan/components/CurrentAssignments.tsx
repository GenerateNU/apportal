'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import type { InterviewGroupDetail } from '@/generated/model'
import { splitByGroup } from '@/lib/interview-groups'
import { useInterviewReviewersBulk } from '@/lib/queries/interview-assignments'
import { useInterviewsByApplicationIds } from '@/lib/queries/interviews'

type Applicant = { application_id: string; full_name: string }

type Queue = {
  key: string
  title: string
  members?: string
  isGroup: boolean
  applicants: Applicant[]
}

export function CurrentAssignments({
  kind,
  applicants,
  groups,
}: {
  kind: 'interviewers' | 'reviewers'
  applicants: Applicant[]
  groups: InterviewGroupDetail[]
}) {
  const [open, setOpen] = useState(true)
  const ids = useMemo(
    () => applicants.map((a) => a.application_id),
    [applicants]
  )
  const { data: interviewsByApp } = useInterviewsByApplicationIds(
    kind === 'interviewers' ? ids : []
  )
  const { data: reviewersByApp } = useInterviewReviewersBulk(
    kind === 'reviewers' ? ids : []
  )

  const { queues, unassigned } = useMemo(() => {
    const byKey = new Map<string, Queue>()
    const unassigned: Applicant[] = []
    const push = (q: Omit<Queue, 'applicants'>, applicant: Applicant) => {
      const queue = byKey.get(q.key) ?? { ...q, applicants: [] }
      queue.applicants.push(applicant)
      byKey.set(q.key, queue)
    }

    for (const a of applicants) {
      if (kind === 'interviewers') {
        const assigned = interviewsByApp?.[a.application_id]?.interviewers ?? []
        if (assigned.length === 0) {
          unassigned.push(a)
          continue
        }
        const { groupBlocks, solo } = splitByGroup(assigned, groups)
        for (const { group, members } of groupBlocks) {
          push(
            {
              key: `group:${group.id}`,
              title: group.name,
              members: members
                .map((m) => m.interviewer_name ?? m.interviewer_nuid)
                .join(', '),
              isGroup: true,
            },
            a
          )
        }
        for (const x of solo) {
          push(
            {
              key: `lead:${x.interviewer_nuid}`,
              title: x.interviewer_name ?? x.interviewer_nuid,
              isGroup: false,
            },
            a
          )
        }
      } else {
        const reviewers = reviewersByApp?.[a.application_id] ?? []
        if (reviewers.length === 0) {
          unassigned.push(a)
          continue
        }
        for (const r of reviewers) {
          push(
            {
              key: `lead:${r.reviewer_nuid}`,
              title: r.reviewer_name ?? r.reviewer_nuid,
              isGroup: false,
            },
            a
          )
        }
      }
    }

    const queues = [...byKey.values()].sort(
      (x, y) =>
        Number(y.isGroup) - Number(x.isGroup) || x.title.localeCompare(y.title)
    )
    const byName = (x: Applicant, y: Applicant) =>
      x.full_name.localeCompare(y.full_name)
    for (const q of queues) q.applicants.sort(byName)
    return { queues, unassigned: unassigned.sort(byName) }
  }, [applicants, kind, interviewsByApp, reviewersByApp, groups])

  if (applicants.length === 0) return null
  const assignedCount = applicants.length - unassigned.length

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4">
      <button
        type="button"
        className="text-text-default flex w-full items-center gap-2 text-sm font-semibold"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Current {kind === 'interviewers' ? 'interviewer' : 'reviewer'}{' '}
        assignments
        <span className="text-text-faint font-normal">
          ({assignedCount} of {applicants.length} assigned)
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {queues.length === 0 ? (
            <p className="text-text-faint text-xs">Nobody is assigned yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {queues.map((q) => (
                <div
                  key={q.key}
                  className="flex flex-col gap-1.5 rounded-lg border border-gray-100 p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-text-default flex items-center gap-1.5 text-sm font-medium">
                      {q.isGroup && (
                        <Users size={12} className="text-text-faint" />
                      )}
                      {q.title}
                    </span>
                    <span className="text-text-faint text-xs">
                      {q.applicants.length}
                    </span>
                  </div>
                  {q.members && (
                    <p className="text-text-muted -mt-1 text-xs">{q.members}</p>
                  )}
                  <ul className="text-text-default flex flex-col gap-0.5 text-xs">
                    {q.applicants.map((a) => (
                      <li key={a.application_id}>{a.full_name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {unassigned.length > 0 && (
            <div>
              <p className="text-text-muted mb-1.5 text-xs">
                Not assigned yet ({unassigned.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map((a) => (
                  <span
                    key={a.application_id}
                    className="text-text-muted inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs"
                  >
                    {a.full_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
