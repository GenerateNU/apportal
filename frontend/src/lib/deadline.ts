const DAY = 24 * 60 * 60 * 1000

export function formatDeadline(date: Date) {
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return `${day} at ${time}`
}

export function timeLeft(date: Date, now = new Date()) {
  const ms = date.getTime() - now.getTime()
  const abs = Math.abs(ms)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const value =
    abs >= DAY
      ? rtf.format(Math.round(ms / DAY), 'day')
      : abs >= 60 * 60 * 1000
        ? rtf.format(Math.round(ms / (60 * 60 * 1000)), 'hour')
        : rtf.format(Math.round(ms / 60000), 'minute')
  return {
    text: ms < 0 ? `Closed ${value}` : value,
    passed: ms < 0,
    soon: ms >= 0 && ms < 2 * DAY,
  }
}
