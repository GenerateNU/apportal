import { Check, PenLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function FormStatusBadge({ written }: { written: boolean }) {
  return written ? (
    <Badge className="bg-green-100 text-green-800">
      <Check size={12} />
      Written
    </Badge>
  ) : (
    <Badge className="bg-amber-100 text-amber-800">
      <PenLine size={12} />
      To write
    </Badge>
  )
}
