export function cycleHref(cycleId: string, template: string): string {
  return template.replace(/^\/cycle(?=[/?#]|$)/, `/cycles/${cycleId}`)
}

export function toCycleTemplate(pathname: string): string {
  return pathname.replace(/^\/cycles\/[^/?#]+/, '/cycle')
}

export function cycleIdFromPath(pathname: string): string | undefined {
  return pathname.match(/^\/cycles\/([^/?#]+)/)?.[1]
}
