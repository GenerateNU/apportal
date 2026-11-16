package application

import (
	"encoding/json"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// AnswerFilterInput is one decoded entry of the answer_filters query param.
// Values is deliberately loose — a single string for free-text questions, an
// array for choice questions — so the UI can send the shape it already holds.
type AnswerFilterInput struct {
	QuestionID string `json:"question_id"`
	// QuestionIDs is the any-of counterpart of QuestionID, for a question the
	// form authors once per applicant role: the filter matches an answer to
	// any of them. Both may be set; they're unioned.
	QuestionIDs  []string            `json:"question_ids"`
	QuestionType models.QuestionType `json:"question_type"`
	Values       json.RawMessage     `json:"values"`
}

// AnswerMatch is how an AnswerFilter compares its values. The caller picks it
// from the question type: checkbox answers live in answer_options as a JSONB
// array, everything else in answer_text.
type AnswerMatch string

const (
	// MatchContains is a case-insensitive substring match on answer_text.
	MatchContains AnswerMatch = "contains"
	// MatchAnyOf is an exact match on answer_text, for single-choice questions.
	MatchAnyOf AnswerMatch = "any_of"
	// MatchAnyOption matches answer_options holding any value, for checkboxes.
	MatchAnyOption AnswerMatch = "any_option"
)

// AnswerFilter keeps applications whose answer to one of QuestionIDs matches.
// Values are OR'd within a filter and filters are AND'd; QuestionIDs spans the
// per-role copies of the same question.
type AnswerFilter struct {
	QuestionIDs []string
	Match       AnswerMatch
	Values      []string
}
