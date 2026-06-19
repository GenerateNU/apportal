import type { Rating } from '@/types/applicant'
import {
  ALL_MAJORS,
  ALL_RATINGS,
  ALL_YEARS,
  ratingLabel,
  type FilterKey,
} from './constants'
import { ActiveFilterPill } from './ActiveFilterPill'
import { AddFilterButton } from './AddFilterButton'

export function FilterBar({
  selectedMajors,
  onChangeMajors,
  selectedYears,
  onChangeYears,
  selectedRatings,
  onChangeRatings,
}: {
  selectedMajors: string[]
  onChangeMajors: (v: string[]) => void
  selectedYears: number[]
  onChangeYears: (v: number[]) => void
  selectedRatings: Rating[]
  onChangeRatings: (v: Rating[]) => void
}) {
  const activeKeys: FilterKey[] = [
    ...(selectedMajors.length > 0 ? (['major'] as FilterKey[]) : []),
    ...(selectedYears.length > 0 ? (['year'] as FilterKey[]) : []),
    ...(selectedRatings.length > 0 ? (['rating'] as FilterKey[]) : []),
  ]

  function handleAdd(key: FilterKey) {
    if (key === 'major') onChangeMajors(ALL_MAJORS)
    if (key === 'year') onChangeYears(ALL_YEARS)
    if (key === 'rating') onChangeRatings(ALL_RATINGS)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5">
      {selectedMajors.length > 0 && (
        <ActiveFilterPill
          label="Major"
          values={selectedMajors}
          renderValue={(v) => v}
          options={ALL_MAJORS}
          onChange={onChangeMajors}
          onClear={() => onChangeMajors([])}
        />
      )}
      {selectedYears.length > 0 && (
        <ActiveFilterPill
          label="Year"
          values={selectedYears}
          renderValue={(v) => `Year ${v}`}
          options={ALL_YEARS}
          onChange={onChangeYears}
          onClear={() => onChangeYears([])}
        />
      )}
      {selectedRatings.length > 0 && (
        <ActiveFilterPill
          label="Rating"
          values={selectedRatings}
          renderValue={(v) => ratingLabel[v]}
          options={ALL_RATINGS}
          onChange={onChangeRatings}
          onClear={() => onChangeRatings([])}
        />
      )}
      <AddFilterButton activeKeys={activeKeys} onAdd={handleAdd} />
    </div>
  )
}
