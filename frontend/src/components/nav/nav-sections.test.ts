import { describe, expect, it } from 'vitest'
import { withApplyItems } from './nav-sections'

const apply = [{ href: '/applicant/applications', label: 'My applications' }]
const myWork = {
  id: 'my-work',
  items: [{ href: '/reviewer/my-work', label: 'My work' }],
}
const admin = {
  id: 'admin',
  label: 'Admin',
  items: [{ href: '/admin/branches', label: 'Branches' }],
}

describe('withApplyItems', () => {
  it('joins an untitled first section, like a lead’s My work', () => {
    expect(withApplyItems([myWork, admin], apply)).toEqual([
      { ...myWork, items: [...myWork.items, ...apply] },
      admin,
    ])
  })

  it('gets its own untitled section above a titled one, like Admin', () => {
    expect(withApplyItems([admin], apply)).toEqual([
      { id: 'apply', items: apply },
      admin,
    ])
  })

  it('stands alone when there are no staff sections', () => {
    expect(withApplyItems([], apply)).toEqual([{ id: 'apply', items: apply }])
  })
})
