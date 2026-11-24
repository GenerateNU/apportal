export function isOtherOption(option: string) {
  return /^other\b/i.test(option.trim())
}

export function otherPrefix(option: string) {
  return `${option}: `
}

export function matchesOption(answer: string, option: string) {
  return (
    answer === option ||
    (isOtherOption(option) && answer.startsWith(otherPrefix(option)))
  )
}

export function otherDetail(answer: string, option: string) {
  return answer.startsWith(otherPrefix(option))
    ? answer.slice(otherPrefix(option).length)
    : ''
}

export function withOtherDetail(option: string, detail: string) {
  return detail ? `${otherPrefix(option)}${detail}` : option
}
