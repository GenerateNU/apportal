import {
  AlignLeft,
  ChevronDown,
  CircleDot,
  Link2,
  ListChecks,
  Star,
  Type,
} from 'lucide-react'
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

// Types selectable in the applicant-facing application builder's palette.
export const QUESTION_TYPES: QuestionType[] = [
  'short_answer',
  'long_answer',
  'multiple_choice',
  'checkbox',
  'dropdown',
  'url',
]

// Types selectable in the review-questions builder's palette — adds `score`
// (a 1-10 numeric rating), which doesn't make sense on an applicant-facing
// question and so is deliberately excluded from QUESTION_TYPES above.
export const REVIEW_QUESTION_TYPES: QuestionType[] = [
  'score',
  'short_answer',
  'long_answer',
  'multiple_choice',
  'checkbox',
  'dropdown',
]

// Covers every QuestionType (including `score`) so QuestionCard — shared by
// both builders — can render any question regardless of which palette
// created it.
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
  dropdown: { label: 'Dropdown', icon: ChevronDown, hasOptions: true },
  url: { label: 'URL', icon: Link2, hasOptions: false },
  score: { label: 'Score (1-10)', icon: Star, hasOptions: false },
}

export const DEFAULT_OPTIONS = ['Option 1', 'Option 2']
