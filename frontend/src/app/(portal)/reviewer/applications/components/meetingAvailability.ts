import type { Question, WrittenAnswer } from '@/lib/api/types'

// "Meeting Availability for the Fall Semester" is a regular per-cycle/role
// checkbox question authored in the admin builder, not a dedicated field —
// matched by text (case-insensitively, substring) since cycles author their
// own exact wording and formatting.
export function isAvailabilityQuestion(text: string): boolean {
  return text.toLowerCase().includes('availability')
}

// Day-name substring match rather than exact string equality: the same
// question asked for different roles has used slightly different spacing
// (e.g. "6:00-7:30 PM" vs "6:00-7:30PM"), so matching on the day name alone
// is what's actually stable across cycles.
export const AVAILABILITY_DAY_OPTIONS = [
  { code: 'M', day: 'monday', label: 'Monday' },
  { code: 'T', day: 'tuesday', label: 'Tuesday' },
  { code: 'W', day: 'wednesday', label: 'Wednesday' },
  { code: 'Th', day: 'thursday', label: 'Thursday' },
] as const

// Single source of truth for a day's display label, shared by anything
// showing a MeetingDay value (a preference list's chosen meeting day, its
// picker, etc.) — keyed the same way AVAILABILITY_DAY_OPTIONS.day is.
export const MEETING_DAY_LABEL: Record<
  (typeof AVAILABILITY_DAY_OPTIONS)[number]['day'],
  string
> = Object.fromEntries(
  AVAILABILITY_DAY_OPTIONS.map((d) => [d.day, d.label])
) as Record<(typeof AVAILABILITY_DAY_OPTIONS)[number]['day'], string>

export function findAvailabilityQuestionId(
  questions: Question[] | undefined
): string | undefined {
  return questions?.find((q) => isAvailabilityQuestion(q.question_text))?.id
}

// Turns a checkbox answer's selected option labels into short day codes
// (e.g. ["Monday 6:00-7:30 PM", "Wednesday 6:00-7:30PM"] -> ["M", "W"]),
// in day order regardless of the order the applicant checked them in.
export function shortDays(options: string[] | null | undefined): string[] {
  if (!options || options.length === 0) return []
  const lower = options.map((o) => o.toLowerCase())
  return AVAILABILITY_DAY_OPTIONS.filter((d) =>
    lower.some((o) => o.includes(d.day))
  ).map((d) => d.code)
}

export function availabilityOptionsFor(
  answers: WrittenAnswer[] | undefined,
  questionId: string | undefined
): string[] | null | undefined {
  if (!questionId) return undefined
  return answers?.find((a) => a.question_id === questionId)?.answer_options
}
