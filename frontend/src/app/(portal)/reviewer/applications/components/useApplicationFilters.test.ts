import { describe, expect, it } from 'vitest'
import type { Question } from '@/lib/api/types'
import type { AnswerFilter } from './FilterButton'
import {
  answerFiltersForChips,
  questionIdsByQuestionText,
} from './useApplicationFilters'

function question(id: string, text: string): Question {
  return {
    id,
    question_text: text,
    question_type: 'short_answer',
    options: null,
    display_order: 0,
    is_required: false,
    cycle_id: 'c1',
    role: 'software_engineer',
    created_at: '',
  }
}

function chip(questionId: string, text: string): AnswerFilter {
  return {
    question_id: questionId,
    question_text: text,
    question_type: 'short_answer',
    values: 'boston',
  }
}

describe('questionIdsByQuestionText', () => {
  it('collects every role copy of the same question under one key', () => {
    const map = questionIdsByQuestionText({
      'c1:software_engineer': [question('se-1', 'First Name')],
      'c1:software_designer': [question('sd-1', ' first name ')],
    })
    expect(map.get('first name')).toEqual(['se-1', 'sd-1'])
  })
})

describe('answerFiltersForChips', () => {
  // The regression this guards: the chip list dedupes by text and keeps one
  // role's id, so sending that id alone drops every other role's applicants.
  it('sends every role copy of the chip’s question', () => {
    const map = questionIdsByQuestionText({
      'c1:software_engineer': [question('se-1', 'First Name')],
      'c1:software_designer': [question('sd-1', 'First Name')],
    })
    expect(answerFiltersForChips([chip('se-1', 'First Name')], map)).toEqual([
      {
        question_id: 'se-1',
        question_ids: ['sd-1'],
        question_type: 'short_answer',
        values: 'boston',
      },
    ])
  })

  it('falls back to the chip’s own id when the text is unknown', () => {
    expect(answerFiltersForChips([chip('se-1', 'Gone')], new Map())).toEqual([
      {
        question_id: 'se-1',
        question_ids: [],
        question_type: 'short_answer',
        values: 'boston',
      },
    ])
  })

  it('leaves the synthetic chips to their own query params', () => {
    const special: AnswerFilter = {
      question_id: '__rating__',
      question_text: 'Interview Rating',
      question_type: 'dropdown',
      values: ['Must hire'],
      special: 'rating',
    }
    expect(answerFiltersForChips([special], new Map())).toEqual([])
  })
})
