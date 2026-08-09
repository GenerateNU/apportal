package handlers

import (
	"encoding/json"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// maxAnswerFilters caps the filter list because each one adds a join.
const maxAnswerFilters = 25

// AnswerFilterInput is one decoded entry of the answer_filters query param.
// Values is deliberately loose — a single string for free-text questions, an
// array for choice questions — so the UI can send the shape it already holds.
type AnswerFilterInput struct {
	QuestionID   string              `json:"question_id"`
	QuestionType models.QuestionType `json:"question_type"`
	Values       json.RawMessage     `json:"values"`
}

// parseAnswerFilters decodes the query param and maps each question type onto
// the match the store should run, which is what decides whether the answer is
// read from answer_options (checkbox) or answer_text (everything else).
func parseAnswerFilters(raw string) ([]store.AnswerFilter, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	var in []AnswerFilterInput
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		return nil, huma.Error422UnprocessableEntity("answer_filters must be a JSON array of filters")
	}
	if len(in) > maxAnswerFilters {
		return nil, huma.Error422UnprocessableEntity("too many answer_filters")
	}
	out := make([]store.AnswerFilter, 0, len(in))
	for _, f := range in {
		if f.QuestionID == "" {
			return nil, huma.Error422UnprocessableEntity("answer_filters entries need a question_id")
		}
		if !f.QuestionType.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid question_type in answer_filters")
		}
		values, err := decodeFilterValues(f.Values)
		if err != nil {
			return nil, err
		}
		// An empty value isn't a narrowing — the UI can hold a half-built
		// filter — so it's dropped rather than rejected.
		if len(values) == 0 {
			continue
		}
		match := store.MatchContains
		switch f.QuestionType {
		case models.QuestionCheckbox:
			match = store.MatchAnyOption
		case models.QuestionDropdown, models.QuestionMultipleChoice:
			match = store.MatchAnyOf
		}
		out = append(out, store.AnswerFilter{
			QuestionID: f.QuestionID,
			Match:      match,
			Values:     values,
		})
	}
	return out, nil
}

// decodeFilterValues accepts either "text" or ["a","b"], normalizing both to a
// slice. Blank entries are dropped so an empty text box doesn't match every
// answer via `%%`.
func decodeFilterValues(raw json.RawMessage) ([]string, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var one string
	if err := json.Unmarshal(raw, &one); err == nil {
		if strings.TrimSpace(one) == "" {
			return nil, nil
		}
		return []string{one}, nil
	}
	var many []string
	if err := json.Unmarshal(raw, &many); err != nil {
		return nil, huma.Error422UnprocessableEntity("answer_filters values must be a string or an array of strings")
	}
	out := make([]string, 0, len(many))
	for _, v := range many {
		if strings.TrimSpace(v) == "" {
			continue
		}
		out = append(out, v)
	}
	return out, nil
}
