import { describe, expect, it } from 'vitest'
import type { InterviewGroupDetail } from '@/generated/model'
import type { Interviewer } from '@/lib/api/types'
import { splitByGroup } from './interview-groups'

const iv = (nuid: string) =>
  ({ id: `iv-${nuid}`, interviewer_nuid: nuid }) as Interviewer
const group = (id: string, ...nuids: string[]) =>
  ({
    id,
    name: id,
    members: nuids.map((n) => ({ member_nuid: n, full_name: n })),
  }) as InterviewGroupDetail

describe('splitByGroup', () => {
  it('shows a fully assigned group as a block', () => {
    const { groupBlocks, solo } = splitByGroup(
      [iv('a'), iv('b'), iv('c')],
      [group('g1', 'a', 'b')]
    )
    expect(groupBlocks.map((b) => b.group.id)).toEqual(['g1'])
    expect(groupBlocks[0].members.map((m) => m.interviewer_nuid)).toEqual([
      'a',
      'b',
    ])
    expect(solo.map((m) => m.interviewer_nuid)).toEqual(['c'])
  })

  it('keeps a partly assigned group as individuals', () => {
    const { groupBlocks, solo } = splitByGroup(
      [iv('a')],
      [group('g1', 'a', 'b')]
    )
    expect(groupBlocks).toEqual([])
    expect(solo.map((m) => m.interviewer_nuid)).toEqual(['a'])
  })

  it('treats a one-person group as a single interviewer', () => {
    const { groupBlocks, solo } = splitByGroup([iv('a')], [group('g1', 'a')])
    expect(groupBlocks).toEqual([])
    expect(solo).toHaveLength(1)
  })
})
