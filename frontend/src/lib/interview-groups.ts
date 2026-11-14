import type { InterviewGroupDetail } from '@/generated/model'
import type { Interviewer } from '@/lib/api/types'

export function splitByGroup(
  assigned: Interviewer[],
  groups: InterviewGroupDetail[]
) {
  const byNuid = new Map(assigned.map((x) => [x.interviewer_nuid, x]))
  const claimed = new Set<string>()
  const groupBlocks: { group: InterviewGroupDetail; members: Interviewer[] }[] =
    []
  for (const group of groups) {
    const nuids = (group.members ?? []).map((m) => m.member_nuid)
    if (nuids.length < 2) continue
    if (!nuids.every((n) => byNuid.has(n) && !claimed.has(n))) continue
    nuids.forEach((n) => claimed.add(n))
    groupBlocks.push({ group, members: nuids.map((n) => byNuid.get(n)!) })
  }
  const solo = assigned.filter((x) => !claimed.has(x.interviewer_nuid))
  return { groupBlocks, solo }
}
