import type { Role } from '@/lib/api/types'
import type { ApplicationTemplateCard } from './types'
import { roleDot, roleLabel } from './constants'
import { ApplicationCard } from './ApplicationCard'

export function RoleColumn({
  role,
  templates,
}: {
  role: Role
  templates: ApplicationTemplateCard[]
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${roleDot[role]}`} />
        <span className="text-text-default text-sm font-semibold">
          {roleLabel[role]}
        </span>
        <span className="text-text-subtle text-sm">{templates.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {templates.map((t) => (
          <ApplicationCard key={`${t.cycleId}-${t.role}`} template={t} />
        ))}
        {templates.length === 0 && (
          <p className="text-text-faint px-1 text-xs">No cycles yet</p>
        )}
      </div>
    </div>
  )
}
