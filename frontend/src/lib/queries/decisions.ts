import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listDecisionContext,
  listDecisionTemplates,
  listDecisions,
  updateDecisionTemplate,
  upsertDecision,
} from '@/generated/decisions/decisions'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type {
  DecisionContext,
  DecisionKind,
  DecisionRow,
  DecisionTemplate,
  Role,
} from '@/lib/api/types'
import { queryKeys } from './keys'

export interface DecisionListParams {
  role?: Role
  kind?: DecisionKind
  // A lead's own queue: only applicants they interviewed.
  interviewer_nuid?: string
  search?: string
}

// Every row the page renders in one request — the list carries the applicant,
// the letter that applies, and whatever's been written, so no row needs a
// follow-up fetch.
export function useDecisions(
  cycleId: string,
  params?: DecisionListParams,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.decisions.list(cycleId, params),
    queryFn: async () =>
      ((await listDecisions(cycleId, params, opts)) ?? []) as DecisionRow[],
    enabled: !!cycleId,
  })
}

// Both letters for a (cycle, role). The backend seeds default content on first
// access, so this never returns an empty pair for a real cycle.
export function useDecisionTemplates(
  cycleId: string,
  role: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.decisions.templates(cycleId, role),
    queryFn: async () =>
      ((await listDecisionTemplates(cycleId, { role }, opts)) ??
        []) as DecisionTemplate[],
    enabled: !!cycleId,
  })
}

// The review history behind a batch of applicants, keyed by application id.
// One request for the batch rather than three per row (interview, then its
// recording reviews, then the written ones) — a lead's queue loads its whole
// context in a single round trip, so opening a row is instant.
export function useDecisionContext(
  applicationIds: string[],
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.decisions.context(applicationIds),
    queryFn: async () => {
      const entries = ((await listDecisionContext(
        { application_ids: applicationIds.join(',') },
        opts
      )) ?? []) as DecisionContext[]

      const byApplicationId: Record<string, DecisionContext> = {}
      for (const entry of entries) byApplicationId[entry.application_id] = entry
      return byApplicationId
    },
    enabled: applicationIds.length > 0,
  })
}

export interface UpsertDecisionVars {
  applicationId: string
  feedback?: string
  compliments?: string
  // Chief-only; the backend rejects these from anyone else.
  kind?: DecisionKind
  body_override?: string
  mark_sent?: boolean
}

// Writes one applicant's paragraphs. The response is the whole recomputed row
// (status included), so it's patched straight into every cached list rather
// than triggering a refetch of the entire cycle.
export function useUpsertDecision(cycleId: string, opts?: RequestOptions) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ applicationId, ...body }: UpsertDecisionVars) =>
      (await upsertDecision(applicationId, body, opts)) as DecisionRow,
    onSuccess: (row, vars) => {
      queryClient.setQueriesData<DecisionRow[]>(
        { queryKey: queryKeys.decisions.lists() },
        (rows) =>
          rows?.map((r) =>
            r.application_id === row.application_id ? row : r
          ) ?? rows
      )
      // Only a kind change moves a row between lists, which patching in place
      // can't express. Every other edit is already correct above, and this
      // fires on each save — refetching the cycle every time would be waste.
      if (vars.kind) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.decisions.listsForCycle(cycleId),
        })
      }
    },
  })
}

export function useUpdateDecisionTemplate(
  cycleId: string,
  role: Role,
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      kind: DecisionKind
      subject: string
      body: string
    }) =>
      (await updateDecisionTemplate(
        cycleId,
        { subject: vars.subject, body: vars.body },
        { role, kind: vars.kind },
        opts
      )) as DecisionTemplate,
    onSuccess: (template) => {
      queryClient.setQueryData<DecisionTemplate[]>(
        queryKeys.decisions.templates(cycleId, role),
        (templates) =>
          templates?.map((t) => (t.kind === template.kind ? template : t)) ??
          templates
      )
    },
  })
}
