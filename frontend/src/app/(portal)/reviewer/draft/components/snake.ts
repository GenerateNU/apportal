// The snake: odd rounds run down the order, even rounds back up it. Mirrors
// SnakePosition in the backend's store/drafts.go — the server decides which
// team a pick belongs to, this is only for labelling the board.
export function snakeSeat(pickNumber: number, teamCount: number): number {
  if (teamCount <= 0 || pickNumber <= 0) return 0
  const index = (pickNumber - 1) % teamCount
  const round = Math.floor((pickNumber - 1) / teamCount) + 1
  return round % 2 === 0 ? teamCount - 1 - index : index
}

export function roundOf(pickNumber: number, teamCount: number): number {
  if (teamCount <= 0 || pickNumber <= 0) return 0
  return Math.floor((pickNumber - 1) / teamCount) + 1
}
