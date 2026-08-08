export type ApplicationPage<Q> = {
  title: string | null
  questions: Q[]
}

// Groups a cycle+role's questions (already sorted by display_order) into
// pages. A non-null page_title on a question means a new page starts there,
// titled page_title; questions before the first such marker form an
// untitled first page. Used identically by the applicant-facing form and
// the builder's live preview, so both paginate the same way. Generic (rather
// than fixed to Question) so the same grouping logic works for the review
// builder's preview too, where page_title is optional.
export function groupQuestionsIntoPages<Q extends { page_title?: string }>(
  questions: Q[]
): ApplicationPage<Q>[] {
  const pages: ApplicationPage<Q>[] = []
  for (const question of questions) {
    if (question.page_title || pages.length === 0) {
      pages.push({ title: question.page_title ?? null, questions: [] })
    }
    pages[pages.length - 1].questions.push(question)
  }
  return pages
}
