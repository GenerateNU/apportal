const AUDIENCE: Record<string, string> = {
  member: 'Members',
  lead: 'Leads',
  chief: 'Chiefs',
}

export function cycleAudience(type?: string) {
  return AUDIENCE[type ?? 'member'] ?? 'Members'
}
