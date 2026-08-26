'use client'

import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Question, Role } from '@/lib/api/types'
import { useQuestionsByCycleRoles } from '@/lib/queries/questions'
import { RATING_OPTIONS } from '@/lib/interview-ratings'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { ORDERED_STAGES, stageLabel } from './constants'
import type { AnswerFilter } from './FilterButton'
import {
  AVAILABILITY_DAY_OPTIONS,
  findAvailabilityQuestionId,
} from './meetingAvailability'

// Chips are tied to a question by text, not by id. Each applicant role gets
// its own copy of a shared question ("First Name") with its own id, so a chip
// built under one role has to resolve to every role's copy — otherwise it
// drops every other role's applicants, whose answers hang off a different id.
export function questionIdsByQuestionText(
  questionsByCycleRole: Record<string, Question[]>
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const questions of Object.values(questionsByCycleRole)) {
    for (const q of questions) {
      const key = q.question_text.trim().toLowerCase()
      map.set(key, [...(map.get(key) ?? []), q.id])
    }
  }
  return map
}

// The chips that target a real question, as the wire's answer_filters entries.
export function answerFiltersForChips(
  filters: AnswerFilter[],
  idsByText: Map<string, string[]>
) {
  return filters
    .filter((f) => !f.special)
    .map((f) => ({
      // Both: the server unions them, and question_id alone is still a valid
      // (single-role) filter for a server that predates question_ids.
      question_id: f.question_id,
      question_ids: (
        idsByText.get(f.question_text.trim().toLowerCase()) ?? []
      ).filter((id) => id !== f.question_id),
      question_type: f.question_type,
      values: f.values,
    }))
}

// Everything the filter chips need on top of the chips themselves: which
// cycle+role questions they can be built from, and the list-applications query
// params they translate to. Shared by the applications table and the
// preference-list applicant pool so both filter the same way, in SQL.
export function useApplicationFilters({
  cycleId,
  defaultRoles,
  filters,
  setFilters,
}: {
  cycleId: string
  // The roles in view when no Role chip is set. One role keeps the query
  // keyed exactly as it was before the chip existed.
  defaultRoles: Role[]
  filters: AnswerFilter[]
  setFilters: Dispatch<SetStateAction<AnswerFilter[]>>
}) {
  const roles = useMemo(() => {
    const chip = filters.find((f) => f.special === 'role')
    if (!chip) return defaultRoles
    const labels = Array.isArray(chip.values) ? chip.values : [chip.values]
    const picked = ROLE_COLUMNS.filter((r) => labels.includes(ROLE_LABEL[r]))
    return picked.length > 0 ? picked : defaultRoles
  }, [filters, defaultRoles])

  // Taken from the selected cycle+roles rather than from the results, since a
  // filter that matches nothing would otherwise empty the question list the
  // filter UI itself is built from.
  const pairs = useMemo(
    () => (cycleId ? roles.map((role) => ({ cycleId, role })) : []),
    [cycleId, roles]
  )
  const questionQueries = useQuestionsByCycleRoles(pairs)
  const questionsByCycleRole = useMemo(() => {
    const map: Record<string, Question[]> = {}
    pairs.forEach((pair, i) => {
      const data = questionQueries[i]?.data
      if (data) map[`${pair.cycleId}:${pair.role}`] = data
    })
    return map
  }, [pairs, questionQueries])

  // One column per distinct question across the visible rows' cycle/role
  // combinations, ordered the same way the application form displays them.
  // Roles within a cycle each get their own copy of common fields (e.g.
  // "First Name") as separate question rows, so we dedupe by text rather than
  // id — otherwise every role duplicates its own column.
  const columns = useMemo(() => {
    const byText = new Map<string, Question>()
    for (const questions of Object.values(questionsByCycleRole)) {
      for (const q of questions) {
        const key = q.question_text.trim().toLowerCase()
        const existing = byText.get(key)
        if (!existing || q.display_order < existing.display_order) {
          byText.set(key, q)
        }
      }
    }
    return [...byText.values()].sort(
      (a, b) =>
        a.display_order - b.display_order ||
        a.created_at.localeCompare(b.created_at)
    )
  }, [questionsByCycleRole])

  const questionIdsByText = useMemo(
    () => questionIdsByQuestionText(questionsByCycleRole),
    [questionsByCycleRole]
  )

  // "Meeting Availability for the Fall Semester" is a regular checkbox
  // question authored per cycle/role in the admin builder, not a dedicated
  // field, so each role in view has its own copy. Kept per role: a row's day
  // tags have to read the answer to its own role's question.
  const availabilityQuestionIdByRole = useMemo(() => {
    const map: Partial<Record<Role, string>> = {}
    for (const role of roles) {
      const id = findAvailabilityQuestionId(
        questionsByCycleRole[`${cycleId}:${role}`]
      )
      if (id) map[role] = id
    }
    return map
  }, [questionsByCycleRole, cycleId, roles])

  // A restored chip — or one left behind by a role switch — can name a
  // question the current cycle/roles don't ask, which empties the results with
  // nothing on screen to explain it. Only prune once the questions are loaded;
  // doing it while they're pending would drop every chip. Specials are
  // synthetic questions (__rating__ and friends) and always apply, except
  // availability, which needs a question in view to expand against.
  const questionsLoaded =
    pairs.length > 0 && questionQueries.every((q) => q.isSuccess)
  // Joined into a string so the effect below re-runs on a real change rather
  // than on every render's fresh Map.
  const knownQuestionTexts = useMemo(
    () => [...questionIdsByText.keys()].sort().join('\u0000'),
    [questionIdsByText]
  )
  const hasAvailability = Object.keys(availabilityQuestionIdByRole).length > 0
  useEffect(() => {
    if (!questionsLoaded) return
    const known = new Set(knownQuestionTexts.split('\u0000'))
    setFilters((prev) => {
      const next = prev.filter((f) =>
        f.special === 'availability'
          ? hasAvailability
          : f.special || known.has(f.question_text.trim().toLowerCase())
      )
      return next.length === prev.length ? prev : next
    })
  }, [questionsLoaded, knownQuestionTexts, hasAvailability, setFilters])

  // The chip picks whole days, but the stored answer holds the full option
  // label ("Monday 6:00-7:30 PM") and the wording drifts between cycles.
  // Expanding each day to the matching labels here — where the options are
  // already loaded — keeps the server filter an exact any-of match.
  const availabilityFilter = useMemo(() => {
    const chip = filters.find((f) => f.special === 'availability')
    const questionIds = Object.values(availabilityQuestionIdByRole)
    if (!chip || questionIds.length === 0) return null
    const labels = Array.isArray(chip.values) ? chip.values : [chip.values]
    const days = AVAILABILITY_DAY_OPTIONS.filter((d) =>
      labels.includes(d.label)
    )
    // Every role's option labels, since one filter now spans all of their
    // question ids and the answer has to match against its own role's wording.
    const options = roles.flatMap(
      (role) =>
        questionsByCycleRole[`${cycleId}:${role}`]?.find(
          (q) => q.id === availabilityQuestionIdByRole[role]
        )?.options ?? []
    )
    const values = [
      ...new Set(
        options.filter((o) => days.some((d) => o.toLowerCase().includes(d.day)))
      ),
    ]
    if (values.length === 0) return null
    return {
      question_id: questionIds[0],
      question_ids: questionIds.slice(1),
      question_type: 'checkbox' as const,
      values,
    }
  }, [
    filters,
    availabilityQuestionIdByRole,
    questionsByCycleRole,
    cycleId,
    roles,
  ])

  // Every filter is applied in SQL, so what comes back is already the answer —
  // nothing downstream narrows it further. Each param is omitted when inactive
  // so an unfiltered list keys identically to the server prefetch.
  const filterParams = useMemo(() => {
    const answerFilters = [
      ...answerFiltersForChips(filters, questionIdsByText),
      ...(availabilityFilter ? [availabilityFilter] : []),
    ]

    // The checkbox lists show labels; the API takes the enum values.
    const ratingValues = filters
      .filter((f) => f.special === 'rating')
      .flatMap((f) => (Array.isArray(f.values) ? f.values : [f.values]))
      .map((label) => RATING_OPTIONS.find((r) => r.label === label)?.value)
      .filter(Boolean)

    const stageValues = filters
      .filter((f) => f.special === 'stage')
      .flatMap((f) => (Array.isArray(f.values) ? f.values : [f.values]))
      .map((label) => ORDERED_STAGES.find((s) => stageLabel[s] === label))
      .filter(Boolean)

    return {
      // Single role travels as `role`, which is what every caller sent before
      // the Role chip existed — same key, same warm cache.
      ...(roles.length === 1 ? { role: roles[0] } : { roles: roles.join(',') }),
      ...(answerFilters.length > 0 && { answer_filters: answerFilters }),
      ...(ratingValues.length > 0 && {
        rating_filters: ratingValues.join(','),
      }),
      ...(stageValues.length > 0 && { stages: stageValues.join(',') }),
    }
  }, [filters, availabilityFilter, questionIdsByText, roles])

  return {
    roles,
    columns,
    questionsByCycleRole,
    availabilityQuestionIdByRole,
    hasAvailability,
    filterParams,
  }
}
