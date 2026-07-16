import { AlignLeft, CircleDot, Link2, ListChecks, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { QuestionType, Role } from '@/lib/api/types'

export const ROLE_LABEL: Record<Role, string> = {
  software_engineer: 'Software Engineer',
  software_designer: 'Software Designer',
}

// Matches the chip colors assigned to each role column on the
// admin/applications board (paletteClass(ROLE_COLUMNS.indexOf(role))).
export const ROLE_CHIP_CLASS: Record<Role, string> = {
  software_engineer: 'bg-chip-1-bg text-chip-1-text',
  software_designer: 'bg-chip-2-bg text-chip-2-text',
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
