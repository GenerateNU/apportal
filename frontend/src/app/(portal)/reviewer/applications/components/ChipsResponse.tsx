export function ChipsResponse({
  options,
}: {
  options: string[] | null | undefined
}) {
  if (!options || options.length === 0) {
    return <span className="text-text-muted text-base">No response</span>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <span
          key={option}
          className="text-ink border border-gray-200 bg-gray-50 px-2.5 py-1 text-sm"
        >
          {option}
        </span>
      ))}
    </div>
  )
}
