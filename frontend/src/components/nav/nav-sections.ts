type Section<I> = { id: string; label?: string; items: I[] }

// The applicant links join the first section only when it's untitled (a
// lead's My work); under a heading like Admin they'd read as admin pages.
export function withApplyItems<I, S extends Section<I>>(
  sections: S[],
  applyItems: I[]
): (S | Section<I>)[] {
  const [first, ...rest] = sections
  if (first && !first.label) {
    return [{ ...first, items: [...first.items, ...applyItems] }, ...rest]
  }
  return [{ id: 'apply', items: applyItems }, ...sections]
}
