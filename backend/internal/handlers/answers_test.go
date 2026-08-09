package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
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

func TestAnswersBulkRequiresReviewer(t *testing.T) {
	h := &answerHandler{}
	in := &ListAnswersBulkInput{ApplicationIDs: "app-1,app-2"}

	_, err := h.listBulk(context.Background(), in)
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnauthorized {
		t.Fatalf("got %v, want 401", err)
	}
}

// Parsing runs before the store is touched, so the empty and over-limit cases
// are reachable without a database.
func TestAnswersBulkParsesIDs(t *testing.T) {
	h := &answerHandler{}
	lead := middleware.Actor{NUID: "l1", Roles: []models.UserRole{models.UserRoleLead}}

	// Blank entries are dropped, and an empty list short-circuits to no rows
	// rather than querying for none.
	out, err := h.listBulk(withActor(lead), &ListAnswersBulkInput{ApplicationIDs: " , ,"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Body) != 0 {
		t.Fatalf("got %d answers, want 0", len(out.Body))
	}

	ids := make([]string, maxBulkApplications+1)
	for i := range ids {
		ids[i] = "app"
	}
	_, err = h.listBulk(withActor(lead), &ListAnswersBulkInput{
		ApplicationIDs: strings.Join(ids, ","),
	})
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnprocessableEntity {
		t.Fatalf("got %v, want 422", err)
	}
}
