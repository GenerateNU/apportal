'use client'
import Link from 'next/link'
import { ChevronsLeft, Maximize2 } from 'lucide-react'
import type { ApplicantApplication } from './types'
import { ApplicantOverview } from './ApplicantOverview'

// The full "everything about this applicant" view, in a slide-over so it's
// reachable straight from the table without losing your place in it — see
// ApplicantOverview for what it shows. Each data source is fetched fresh
// here rather than threaded down as props; the answers/questions hooks it
// uses share a cache key with this page's own bulk fetches, so opening the
// drawer doesn't cost an extra request for those.
export function ApplicationDetail({
  applicant,
  onClose,
}: {
  applicant: ApplicantApplication
  onClose: () => void
}) {
  return (
    <>
      {/* Backdrop. Both layers need an explicit z-index: being `fixed` alone
          leaves them at z-auto, which the table's sticky header (z-20) paints
          straight over. */}
      <div
        className="animate-in fade-in fixed inset-0 z-40 bg-black/30 duration-300"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="animate-in slide-in-from-right-full fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-gray-200 bg-white duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between py-2 pr-6 pl-2">
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-default flex items-center justify-center rounded-md px-1.5 py-1.5 transition-colors hover:bg-gray-100"
            aria-label="Close"
          >
            <ChevronsLeft className="h-5 w-5" />
          </button>
          <Link
            href={`/reviewer/applications/${applicant.id}`}
            className="text-text-muted hover:text-text-default inline-flex items-center gap-1 text-sm transition-colors"
          >
            <Maximize2 className="h-3 w-3" />
            Open full page
          </Link>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            <ApplicantOverview
              applicationId={applicant.id}
              cycleId={applicant.cycleId}
              role={applicant.role}
              applicantNuid={applicant.nuid}
              stage={applicant.stage}
            />
          </div>
        </div>
      </div>
    </>
  )
}
