export function deadlinePassed(closesAt: string | undefined) {
  return !!closesAt && new Date(closesAt) < new Date()
}
