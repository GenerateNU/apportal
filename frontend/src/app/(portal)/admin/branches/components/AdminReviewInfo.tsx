import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/Tooltip'

const EXPLANATION =
  'Admins review chief applications, so this cycle has no leads or chiefs.'

// Stands in for the Leads & chiefs button on chief cycles.
export function AdminReviewInfo() {
  return (
    <Tooltip label={EXPLANATION}>
      <Button variant="outline" aria-label={EXPLANATION}>
        <Info className="h-4 w-4" />
        Reviewed by admins
      </Button>
    </Tooltip>
  )
}
