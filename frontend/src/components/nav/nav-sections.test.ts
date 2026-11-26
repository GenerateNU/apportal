import { describe, expect, it } from 'vitest'
import { withApplyItems } from './nav-sections'

const apply = [{ href: '/applicant/applications', label: 'My applications' }]
const myWork = {
  id: 'my-work',
  items: [{ href: '/my-work', label: 'My work' }],
}
const admin = {
  id: 'admin',
  label: 'Admin',
  items: [{ href: '/admin/branches', label: 'Branches' }],
}

describe('withApplyItems', () => {
  it('puts a staff member’s applications under Applying, after their staff work', () => {
    expect(withApplyItems([myWork, admin], apply)).toEqual([
      myWork,
      admin,
      { id: 'apply', label: 'Applying', items: apply },
    ])
  })

  it('stands alone, untitled, for someone who is only an applicant', () => {
    expect(withApplyItems([], apply)).toEqual([{ id: 'apply', items: apply }])
  })
})
