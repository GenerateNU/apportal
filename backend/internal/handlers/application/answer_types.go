package application

import (
	"encoding/json"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ListAnswersBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

type AnswersOutput struct {
	Body []models.WrittenAnswer
}

type UpsertAnswersInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Answers []struct {
			QuestionID     string          `json:"question_id"`
			AnswerText     *string         `json:"answer_text,omitempty"`
			AnswerOptions  json.RawMessage `json:"answer_options,omitempty"`
			AnswerFilePath *string         `json:"answer_file_path,omitempty"`
			AnswerFileName *string         `json:"answer_file_name,omitempty"`
		} `json:"answers" minItems:"1"`
	}
}

type ListAnswersInput struct {
	ID string `path:"id" doc:"Application ID"`
}

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

// AnswerInput is one answer in a bulk upsert.
type AnswerInput struct {
	QuestionID     string
	AnswerText     *string
	AnswerOptions  json.RawMessage
	AnswerFilePath *string
	AnswerFileName *string
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
