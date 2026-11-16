import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getApplicationTemplate } from '@/generated/application-templates/application-templates'
import { createRole } from '@/generated/roles/roles'
import { createRoleWithDraft } from './roles'

vi.mock('@/generated/roles/roles', () => ({ createRole: vi.fn() }))
vi.mock('@/generated/application-templates/application-templates', () => ({
  getApplicationTemplate: vi.fn(),
}))

const role = {
  id: 'r1',
  cycle_id: 'c1',
  name: 'Web',
  created_at: '2026-11-01T00:00:00Z',
}

describe('createRoleWithDraft', () => {
  beforeEach(() => vi.resetAllMocks())

  it('creates the role, then fetches (and so creates) its draft template', async () => {
    const draft = { id: 't1', status: 'draft' }
    vi.mocked(createRole).mockResolvedValue(role as never)
    vi.mocked(getApplicationTemplate).mockResolvedValue(draft as never)

    const result = await createRoleWithDraft({ cycle_id: 'c1', name: 'Web' })

    expect(getApplicationTemplate).toHaveBeenCalledWith(
      'c1',
      { role_id: 'r1' },
      undefined
    )
    expect(result).toEqual({ role, draft })
  })

  it('still returns the role when the draft cannot be created', async () => {
    vi.mocked(createRole).mockResolvedValue(role as never)
    vi.mocked(getApplicationTemplate).mockRejectedValue(new Error('boom'))

    const result = await createRoleWithDraft({ cycle_id: 'c1', name: 'Web' })

    expect(result).toEqual({ role, draft: null })
  })

  it('does not create a draft when the role fails', async () => {
    vi.mocked(createRole).mockRejectedValue(new Error('duplicate'))

    await expect(
      createRoleWithDraft({ cycle_id: 'c1', name: 'Web' })
    ).rejects.toThrow('duplicate')
    expect(getApplicationTemplate).not.toHaveBeenCalled()
  })
})
