import { Plus } from 'lucide-react'
import type { Role } from '@/lib/api/types'
import type { ApplicationTemplateCard } from './types'
import { ROLE_COLUMNS, paletteClass, roleLabel } from './constants'
import { ApplicationRow } from './ApplicationRow'

export function RoleColumn({
  role,
  templates,
}: {
  role: Role
  templates: ApplicationTemplateCard[]
}) {
  return (
    <div className="flex w-96 shrink-0 flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${paletteClass(ROLE_COLUMNS.indexOf(role))}`}
          >
            {roleLabel[role]}
          </span>
          <span className="text-text-subtle text-sm">{templates.length}</span>
        </div>
        <Plus className="text-text-subtle h-4 w-4" />
      </div>
      <div className="flex flex-col gap-3">
        {templates.map((t) => (
          <ApplicationRow key={`${t.cycleId}-${t.role}`} template={t} />
        ))}
        {templates.length === 0 && (
          <p className="text-text-faint px-1 text-xs">No cycles yet</p>
        )}
      </div>
    </div>
  )
}
