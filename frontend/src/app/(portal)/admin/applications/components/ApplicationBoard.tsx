import type { ApplicationTemplateCard } from './types'
import { ROLE_COLUMNS } from './constants'
import { RoleColumn } from './RoleColumn'

export function ApplicationBoard({
  templates,
}: {
  templates: ApplicationTemplateCard[]
}) {
  return (
    <div className="flex gap-5 overflow-x-auto pb-4">
      {ROLE_COLUMNS.map((role) => (
        <RoleColumn
          key={role}
          role={role}
          templates={templates.filter((t) => t.role === role)}
        />
      ))}
    </div>
  )
}
