const CHIP_COLORS = [
  'bg-red-200 text-red-800',
  'bg-orange-200 text-orange-800',
  'bg-yellow-200 text-yellow-800',
  'bg-lime-200 text-lime-800',
  'bg-green-200 text-green-800',
  'bg-emerald-200 text-emerald-800',
  'bg-teal-200 text-teal-800',
  'bg-cyan-200 text-cyan-800',
  'bg-sky-200 text-sky-800',
  'bg-blue-200 text-blue-800',
  'bg-indigo-200 text-indigo-800',
  'bg-violet-200 text-violet-800',
  'bg-fuchsia-200 text-fuchsia-800',
  'bg-pink-200 text-pink-800',
] as const

export function ChipsResponse({
  options,
}: {
  options: string[] | null | undefined
}) {
  if (!options || options.length === 0) {
    return <span className="text-text-muted text-base">No response</span>
  }

  // Assign unique colors to each unique option in order
  const colorMap = new Map<string, string>()
  let colorIndex = 0

  options.forEach((option) => {
    if (!colorMap.has(option)) {
      colorMap.set(option, CHIP_COLORS[colorIndex % CHIP_COLORS.length])
      colorIndex++
    }
  })

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const colorClass = colorMap.get(option) || CHIP_COLORS[0]
        return (
          <span
            key={option}
            className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${colorClass}`}
          >
            {option}
          </span>
        )
      })}
    </div>
  )
}
