'use client'

import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type DraftTeam = {
  id: string
  name: string
  leadNuids: string[]
}

type Lead = { nuid: string; full_name: string }

export function TeamBuilder({
  teams,
  leads,
  onChange,
}: {
  teams: DraftTeam[]
  leads: Lead[]
  onChange: (teams: DraftTeam[]) => void
}) {
  // A lead belongs to at most one team — the whole point of a team is that its
  // members never review the same application, which only holds if membership
  // is exclusive. Leads already placed are hidden from the other pickers.
  const takenBy = new Map<string, string>()
  for (const team of teams) {
    for (const nuid of team.leadNuids) takenBy.set(nuid, team.id)
  }

  const nameOf = (nuid: string) =>
    leads.find((l) => l.nuid === nuid)?.full_name ?? nuid

  function update(id: string, patch: Partial<DraftTeam>) {
    onChange(teams.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  function addTeam() {
    onChange([
      ...teams,
      {
        id: crypto.randomUUID(),
        name: `Team ${teams.length + 1}`,
        leadNuids: [],
      },
    ])
  }

  const unassigned = leads.filter((l) => !takenBy.has(l.nuid))

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-text-default text-sm font-semibold">Teams</h2>
          <p className="text-text-muted mt-0.5 text-xs">
            Group co-leads together. Teammates never review the same applicant,
            so each application&apos;s reviewers come from different teams.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={addTeam}>
          <Plus size={14} />
          Add team
        </Button>
      </div>

      {teams.length === 0 ? (
        <p className="text-text-faint rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm">
          No teams yet. Add one to start planning.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {teams.map((team) => {
            const available = leads.filter(
              (l) => !takenBy.has(l.nuid) || takenBy.get(l.nuid) === team.id
            )
            const selectable = available.filter(
              (l) => !team.leadNuids.includes(l.nuid)
            )
            return (
              <div
                key={team.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={team.name}
                    onChange={(e) => update(team.id, { name: e.target.value })}
                    aria-label="Team name"
                    className="h-8 text-sm font-medium"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${team.name}`}
                    className="text-text-faint hover:text-destructive flex-shrink-0 rounded-md p-1.5 transition-colors hover:bg-gray-100"
                    onClick={() =>
                      onChange(teams.filter((t) => t.id !== team.id))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {team.leadNuids.length === 0 ? (
                    <span className="text-text-faint text-xs">
                      No leads on this team yet
                    </span>
                  ) : (
                    team.leadNuids.map((nuid) => (
                      <span
                        key={nuid}
                        className="text-text-muted inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium"
                      >
                        {nameOf(nuid)}
                        <button
                          type="button"
                          aria-label={`Remove ${nameOf(nuid)} from ${team.name}`}
                          className="hover:text-destructive"
                          onClick={() =>
                            update(team.id, {
                              leadNuids: team.leadNuids.filter(
                                (n) => n !== nuid
                              ),
                            })
                          }
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <Select
                  value=""
                  onValueChange={(nuid) =>
                    update(team.id, { leadNuids: [...team.leadNuids, nuid] })
                  }
                  disabled={selectable.length === 0}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue
                      placeholder={
                        selectable.length === 0
                          ? 'All leads are on a team'
                          : 'Add a lead…'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectable.map((lead) => (
                      <SelectItem key={lead.nuid} value={lead.nuid}>
                        {lead.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      )}

      {teams.length > 0 && unassigned.length > 0 && (
        <p className="text-text-faint text-xs">
          {unassigned.length} lead{unassigned.length === 1 ? '' : 's'} not on a
          team yet: {unassigned.map((l) => l.full_name).join(', ')}
        </p>
      )}
    </section>
  )
}
