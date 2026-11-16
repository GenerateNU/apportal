'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { apiErrorDetail } from '@/lib/api/client'
import type { WrittenReviewDetail } from '@/lib/api/types'
import {
  useAssignLead,
  useLeadAssignments,
} from '@/lib/queries/lead-assignments'

type Status = 'submitted' | 'draft' | 'not started'

const STATUS_CLASS: Record<Status, string> = {
  submitted: 'bg-status-open/10 text-status-open',
  draft: 'bg-gray-100 text-text-default',
  'not started': 'bg-gray-50 text-text-subtle',
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function ReviewTeam({
  applicationId,
  applicantName,
  me,
  isChief,
  reviews,
  nameByNuid,
}: {
  applicationId: string
  applicantName: string
  me?: string
  isChief: boolean
  reviews: WrittenReviewDetail[]
  nameByNuid: Map<string, string>
}) {
  const router = useRouter()
  const toast = useToast()
  const { data: assignments = [] } = useLeadAssignments(applicationId)
  const assignLead = useAssignLead()
  const [confirming, setConfirming] = useState(false)

  const reviewHref = `/reviewer/my-reviews/${applicationId}`
  const assignedToMe = assignments.some((a) => a.lead_nuid === me)
  const myReview = reviews.find((r) => r.reviewer_nuid === me)
  const others = assignments.filter((a) => a.lead_nuid !== me)
  const otherNames = others.map(
    (a) => nameByNuid.get(a.lead_nuid) ?? a.lead_nuid
  )

  const people = [
    ...assignments.map((a) => a.lead_nuid),
    ...reviews
      .map((r) => r.reviewer_nuid)
      .filter((n) => !assignments.some((a) => a.lead_nuid === n)),
  ]

  function statusOf(nuid: string): Status {
    const review = reviews.find((r) => r.reviewer_nuid === nuid)
    if (!review) return 'not started'
    return review.submitted_at ? 'submitted' : 'draft'
  }

  function openReview() {
    if (assignedToMe || myReview || !isChief) router.push(reviewHref)
    else setConfirming(true)
  }

  async function assignMeAndOpen() {
    if (!me) return
    try {
      await assignLead.mutateAsync({ applicationId, leadNuid: me })
      router.push(reviewHref)
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
          Review team
        </span>
        <Button variant="outline" size="xs" onClick={openReview}>
          {myReview ? 'Open my review' : 'Write a review'}
        </Button>
      </div>
      {people.length === 0 ? (
        <p className="text-text-faint text-sm">No one is assigned yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {people.map((nuid) => {
            const status = statusOf(nuid)
            const assigned = assignments.some((a) => a.lead_nuid === nuid)
            return (
              <li
                key={nuid}
                className="flex items-center gap-1.5 border border-gray-200 px-2 py-1 text-sm"
              >
                <span className="text-ink">
                  {nuid === me ? 'You' : (nameByNuid.get(nuid) ?? nuid)}
                </span>
                <Badge size="sm" className={STATUS_CLASS[status]}>
                  {status}
                </Badge>
                {!assigned && (
                  <span className="text-text-faint text-[11px]">
                    not assigned
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review {applicantName} yourself?</DialogTitle>
            <DialogDescription>
              {others.length > 0
                ? `${joinNames(otherNames)} ${others.length === 1 ? 'is' : 'are'} assigned to review this applicant. Your review is added alongside theirs and counts toward the ranking.`
                : 'No one is assigned to this applicant yet. Your review counts toward the ranking like any lead’s.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push(reviewHref)}>
                Just write it
              </Button>
              <Button disabled={assignLead.isPending} onClick={assignMeAndOpen}>
                Assign me &amp; write
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
