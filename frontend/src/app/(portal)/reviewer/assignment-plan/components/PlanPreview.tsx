'use client'

import { AlertTriangle, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, Toolbar } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat-tile'
import type { AssignmentPlanPreview, PlannedLead } from '@/generated/model'

// The preview is deliberately non-destructive: it shows what *would* be
// assigned. Nothing here writes, so a chief can iterate on teams and caps
// freely before anything is committed.

export function PlanPreview({ plan }: { plan: AssignmentPlanPreview }) {
  // Go marshals empty slices as null, so the generated types are nullable —
  // normalise once here rather than guarding at every use.
  const leads = plan.leads ?? []
  const warnings = plan.warnings ?? []
  const underCovered = plan.under_covered ?? []

  const byTeam = new Map<string, PlannedLead[]>()
  for (const lead of leads) {
    const group = byTeam.get(lead.team_name) ?? []
    group.push(lead)
    byTeam.set(lead.team_name, group)
  }

  const depths = Object.keys(plan.coverage_counts)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <section className="flex flex-col gap-4">
      <Toolbar>
        <StatTile label="Applications" value={plan.pool_size} />
        <StatTile label="Reviews to create" value={plan.total_added} />
        <StatTile label="Target coverage" value={`${plan.coverage} per app`} />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {depths.map((depth) => (
            <Badge
              key={depth}
              className={
                depth >= plan.coverage
                  ? 'bg-chip-1-bg text-chip-1-text'
                  : 'bg-chip-3-bg text-chip-3-text'
              }
            >
              {plan.coverage_counts[depth]} app
              {plan.coverage_counts[depth] === 1 ? '' : 's'} · {depth} reviewer
              {depth === 1 ? '' : 's'}
            </Badge>
          ))}
        </div>
      </Toolbar>

      {warnings.length > 0 && (
        <div className="flex flex-col gap-2 border border-amber-200 bg-amber-50 p-4">
          {warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 text-xs text-amber-900"
            >
              <AlertTriangle size={14} className="mt-px flex-shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      )}

      {underCovered.length > 0 && (
        <Card variant="flat">
          <h3 className="text-text-default text-sm font-semibold">
            Under-covered ({underCovered.length})
          </h3>
          <p className="text-text-muted mt-0.5 mb-2 text-xs">
            These applications could not reach {plan.coverage} reviewers. Raise
            the cap, or add another team.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {underCovered.map((app) => (
              <Badge
                key={app.application_id}
                className="text-text-muted font-normal"
              >
                {app.full_name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {[...byTeam.entries()].map(([teamName, teamLeads]) => (
        <div key={teamName} className="flex flex-col gap-2">
          <h3 className="text-text-default text-sm font-semibold">
            {teamName}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {teamLeads.map((lead) => (
              <LeadQueue key={lead.lead_nuid} lead={lead} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function LeadQueue({ lead }: { lead: PlannedLead }) {
  const atCap = lead.total >= lead.cap
  const applications = lead.applications ?? []
  return (
    <Card variant="flat" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-text-default text-sm font-medium">
          {lead.full_name || lead.lead_nuid}
        </span>
        <span
          className={`text-xs ${atCap ? 'text-amber-700' : 'text-text-faint'}`}
        >
          {lead.total} of {lead.cap}
          {lead.existing > 0 && ` · ${lead.existing} already assigned`}
        </span>
      </div>

      {applications.length === 0 ? (
        <p className="text-text-faint text-xs">Nothing assigned.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {applications.map((app) => (
            <li
              key={app.application_id}
              className="flex items-center gap-2 text-xs"
            >
              {app.already_assigned ? (
                <Check size={12} className="text-text-faint flex-shrink-0" />
              ) : (
                <span className="bg-primary/40 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
              )}
              <span className="text-text-default truncate">
                {app.full_name}
              </span>
              {app.already_assigned && (
                <span className="text-text-faint flex-shrink-0">existing</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
