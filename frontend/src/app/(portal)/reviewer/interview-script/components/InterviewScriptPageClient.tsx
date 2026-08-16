'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Pencil } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Role } from '@/lib/api/types'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { InterviewScriptContent } from './InterviewScriptContent'

export function InterviewScriptPageClient({ isChief }: { isChief: boolean }) {
  const searchParams = useSearchParams()
  const { data: cycles = [] } = useCycles({})

  const [cycleId, setCycleId] = useState(searchParams.get('cycle') ?? '')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }

  const roleParam = searchParams.get('role')
  const [role, setRole] = useState<Role>(
    roleParam === 'software_designer'
      ? 'software_designer'
      : 'software_engineer'
  )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="w-48" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_COLUMNS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-40" aria-label="Filter by cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isChief && cycleId && (
          <Link
            href={`/reviewer/interview-script/edit?cycle=${cycleId}&role=${role}`}
            className="text-brand-blue inline-flex items-center gap-1 text-sm hover:underline"
          >
            <Pencil size={14} />
            Edit script
          </Link>
        )}
      </div>

      <div className="max-w-3xl">
        {cycleId ? (
          <InterviewScriptContent cycleId={cycleId} role={role} />
        ) : (
          <p className="text-text-faint text-sm">No cycles yet.</p>
        )}
      </div>
    </>
  )
}
