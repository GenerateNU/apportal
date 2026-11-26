export function roundOf(pickNumber: number, teamCount: number): number {
  if (teamCount <= 0 || pickNumber <= 0) return 0
  return Math.floor((pickNumber - 1) / teamCount) + 1
}
