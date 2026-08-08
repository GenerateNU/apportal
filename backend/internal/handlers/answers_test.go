package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"
)

// Ownership and stage checks need a real database (they fetch the
// application first) and are covered by integration/manual testing instead —
// see applications_test.go's header comment for the same convention. This
// only covers the one rejection that returns before the handler touches its
// store.

func TestAnswersUpsertRequiresActor(t *testing.T) {
	h := &answerHandler{}
	in := &UpsertAnswersInput{ID: "app-1"}
	in.Body.Answers = []struct {
		QuestionID     string          `json:"question_id"`
		AnswerText     *string         `json:"answer_text,omitempty"`
		AnswerOptions  json.RawMessage `json:"answer_options,omitempty"`
		AnswerFilePath *string         `json:"answer_file_path,omitempty"`
		AnswerFileName *string         `json:"answer_file_name,omitempty"`
	}{{QuestionID: "q-1"}}

	_, err := h.upsert(context.Background(), in)
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnauthorized {
		t.Fatalf("got %v, want 401", err)
	}
}
