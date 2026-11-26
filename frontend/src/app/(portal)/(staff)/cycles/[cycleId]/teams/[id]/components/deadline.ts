export function deadlinePassed(closesAt: string | undefined | null): boolean {
  return !!closesAt && new Date(closesAt) < new Date()
}
