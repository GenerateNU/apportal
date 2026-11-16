type Section<I> = { id: string; label?: string; items: I[] }

// A staff member's own applications get their own Applying section after their
// staff work, so they never read as admin or review pages.
export function withApplyItems<I, S extends Section<I>>(
  sections: S[],
  applyItems: I[]
): (S | Section<I>)[] {
  if (sections.length === 0) return [{ id: 'apply', items: applyItems }]
  return [...sections, { id: 'apply', label: 'Applying', items: applyItems }]
}
