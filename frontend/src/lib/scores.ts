type Scaled = { question_type: string; score_max?: number }

export function scoreOutOf(score: number, question: Scaled) {
  return `${score}/${question.score_max ?? 10}`
}

export function averageLabel(avg: number, questions: Scaled[]) {
  const maxes = new Set(
    questions
      .filter((q) => q.question_type === 'score')
      .map((q) => q.score_max ?? 10)
  )
  const suffix = maxes.size === 1 ? `/${[...maxes][0]}` : ''
  return `avg ${avg.toFixed(1)}${suffix}`
}
