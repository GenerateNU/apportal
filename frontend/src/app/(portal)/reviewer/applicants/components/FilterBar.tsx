import { type FilterKey } from './constants'
import { ActiveFilterPill } from './ActiveFilterPill'
import { AddFilterButton } from './AddFilterButton'

export function FilterBar({
  allMajors,
  selectedMajors,
  onChangeMajors,
  allYears,
  selectedYears,
  onChangeYears,
}: {
  allMajors: string[]
  selectedMajors: string[]
  onChangeMajors: (v: string[]) => void
  allYears: number[]
  selectedYears: number[]
  onChangeYears: (v: number[]) => void
}) {
  const activeKeys: FilterKey[] = [
    ...(selectedMajors.length > 0 ? (['major'] as FilterKey[]) : []),
    ...(selectedYears.length > 0 ? (['year'] as FilterKey[]) : []),
  ]

  function handleAdd(key: FilterKey) {
    if (key === 'major') onChangeMajors(allMajors)
    if (key === 'year') onChangeYears(allYears)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5">
      {selectedMajors.length > 0 && (
        <ActiveFilterPill
          label="Major"
          values={selectedMajors}
          renderValue={(v) => v}
          options={allMajors}
          onChange={onChangeMajors}
          onClear={() => onChangeMajors([])}
        />
      )}
      {selectedYears.length > 0 && (
        <ActiveFilterPill
          label="Year"
          values={selectedYears}
          renderValue={(v) => `Year ${v}`}
          options={allYears}
          onChange={onChangeYears}
          onClear={() => onChangeYears([])}
        />
      )}
      <AddFilterButton activeKeys={activeKeys} onAdd={handleAdd} />
    </div>
  )
}
