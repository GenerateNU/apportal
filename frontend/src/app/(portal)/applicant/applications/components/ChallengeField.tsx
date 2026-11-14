import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CodeChallenge } from '@/lib/api/types'
import { normalizeUrl } from '../lib/url'

export function ChallengeField({
  challenge,
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: {
  challenge: CodeChallenge
  value: string
  onChange: (next: string) => void
  onBlur?: () => void
  error?: string
  disabled?: boolean
}) {
  return (
    <Card
      id="question-challenge"
      padding="lg"
      className="flex scroll-mt-24 flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-3">
        <Label className="text-ink text-base font-semibold" htmlFor="challenge">
          {challenge.name}
        </Label>
        <span className="font-display text-destructive shrink-0 pt-1 text-[10px] tracking-wider uppercase">
          Required
        </span>
      </div>
      {challenge.instructions && (
        <p className="text-text-muted text-sm">{challenge.instructions}</p>
      )}
      <Input
        id="challenge"
        type="url"
        inputMode="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const normalized = normalizeUrl(value)
          if (normalized !== value) onChange(normalized)
          onBlur?.()
        }}
        aria-invalid={!!error}
        placeholder="https://github.com/you/your-submission"
        disabled={disabled}
        className="h-11 text-base md:text-base"
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </Card>
  )
}
