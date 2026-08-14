package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// Only the checks that return before the handler touches its store are
// reachable without a database — same convention as answers_test.go.

func TestInterviewsBulkRequiresReviewer(t *testing.T) {
	h := &interviewHandler{}

	_, err := h.listBulk(context.Background(), &ListInterviewsBulkInput{
		ApplicationIDs: "app-1,app-2",
	})
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnauthorized {
		t.Fatalf("got %v, want 401", err)
	}
}

func TestInterviewsBulkParsesIDs(t *testing.T) {
	h := &interviewHandler{}
	lead := middleware.Actor{NUID: "l1", Roles: []models.UserRole{models.UserRoleLead}}

	// Blank entries are dropped, and an empty list short-circuits to no rows
	// rather than querying for none.
	out, err := h.listBulk(withActor(lead), &ListInterviewsBulkInput{ApplicationIDs: " , ,"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Body) != 0 {
		t.Fatalf("got %d interviews, want 0", len(out.Body))
	}

	ids := make([]string, maxBulkApplications+1)
	for i := range ids {
		ids[i] = "app"
	}
	_, err = h.listBulk(withActor(lead), &ListInterviewsBulkInput{
		ApplicationIDs: strings.Join(ids, ","),
	})
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnprocessableEntity {
		t.Fatalf("got %v, want 422", err)
	}
}
