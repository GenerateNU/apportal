import type { Question } from '@/lib/api/types'

export type ApplicationPage = {
  title: string | null
  questions: Question[]
}

// Groups a cycle+role's questions (already sorted by display_order) into
// pages. A non-null page_title on a question means a new page starts there,
// titled page_title; questions before the first such marker form an
// untitled first page. Used identically by the applicant-facing form and
// the builder's live preview, so both paginate the same way.
export function groupQuestionsIntoPages(
  questions: Question[]
): ApplicationPage[] {
  const pages: ApplicationPage[] = []
  for (const question of questions) {
    if (question.page_title || pages.length === 0) {
      pages.push({ title: question.page_title ?? null, questions: [] })
    }
    pages[pages.length - 1].questions.push(question)
  }
  return pages
}
