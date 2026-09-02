import type { DecisionRow, DecisionTemplate } from '@/lib/api/types'
import { ROLE_LABEL } from '@/lib/roles'

// Placeholders a template may use. The backend stores the letter and the
// applicant's paragraphs separately and never renders — this is the only place
// the two are combined, so what the preview shows is exactly what gets copied.
export type DecisionVar =
  | 'applicant_name'
  | 'role'
  | 'cycle'
  | 'feedback'
  | 'compliments'

// Shown in place of a paragraph the interviewer hasn't written yet, so a
// half-finished message reads as obviously unfinished rather than as a
// grammatical accident.
const MISSING: Record<string, string> = {
  feedback: '[feedback needed]',
  compliments: '[compliments needed]',
}

// Left in place rather than blanked, so a typo'd placeholder is visible in the
// preview instead of silently eating a word.
const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g

export function fillTemplate(
  text: string,
  vars: Partial<Record<DecisionVar, string>>
) {
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    const value = vars[name as DecisionVar]
    if (value) return value
    return MISSING[name] ?? whole
  })
}

export interface RenderedDecision {
  subject: string
  body: string
  // Which placeholders the template asked for and the row hasn't filled in.
  missing: DecisionVar[]
}

// Renders one applicant's message. A chief's hand-written override replaces
// the body outright but still gets its placeholders filled, so overriding a
// paragraph doesn't cost you the applicant's name.
export function renderDecision(
  row: DecisionRow,
  template: DecisionTemplate | undefined,
  cycleName: string
): RenderedDecision {
  const vars: Partial<Record<DecisionVar, string>> = {
    applicant_name: firstName(row.full_name),
    role: ROLE_LABEL[row.application_role],
    cycle: cycleName,
    feedback: row.feedback,
    compliments: row.compliments,
  }
  const body = row.body_override ?? template?.body ?? ''
  return {
    subject: fillTemplate(template?.subject ?? '', vars),
    body: fillTemplate(body, vars),
    missing: missingVars(body, vars),
  }
}

function missingVars(
  body: string,
  vars: Partial<Record<DecisionVar, string>>
): DecisionVar[] {
  const missing = new Set<DecisionVar>()
  for (const [, name] of body.matchAll(PLACEHOLDER)) {
    if (name in MISSING && !vars[name as DecisionVar]) {
      missing.add(name as DecisionVar)
    }
  }
  return [...missing]
}

// Letters open "Dear <first name>". Names arrive as one free-text field, so
// this takes the leading word and leaves anything unusual (a mononym, a name
// written surname-first) as the applicant typed it.
function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName
}
