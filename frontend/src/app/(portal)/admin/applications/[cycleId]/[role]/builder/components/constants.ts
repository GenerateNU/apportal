import { AlignLeft, CircleDot, Link2, ListChecks, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CycleStatus, QuestionType } from '@/lib/api/types'

export const TEMPLATE_STATUS_ORDER: CycleStatus[] = [
  'draft',
  'open',
  'closed',
  'archived',
]

export const TEMPLATE_STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived',
}

export const QUESTION_TYPES: QuestionType[] = [
  'short_answer',
  'long_answer',
  'multiple_choice',
  'checkbox',
  'url',
]

export const QUESTION_TYPE_META: Record<
  QuestionType,
  { label: string; icon: LucideIcon; hasOptions: boolean }
> = {
  short_answer: { label: 'Short answer', icon: Type, hasOptions: false },
  long_answer: { label: 'Long answer', icon: AlignLeft, hasOptions: false },
  multiple_choice: {
    label: 'Multiple choice',
    icon: CircleDot,
    hasOptions: true,
  },
  checkbox: { label: 'Checkboxes', icon: ListChecks, hasOptions: true },
  url: { label: 'URL', icon: Link2, hasOptions: false },
}

export const DEFAULT_OPTIONS = ['Option 1', 'Option 2']
