package application

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

// These only cover the rejection paths, which return before the handler
// touches the database — the acceptance paths need a real database and are
// exercised by integration/manual testing instead.

func TestApplicationCreateRequiresActor(t *testing.T) {
	s := &applicationService{}
	in := &CreateApplicationInput{}
	in.Body.RoleID = "6f1c2a52-6d2c-4a8e-9a57-2b8f3b1c9d10"

	_, err := s.create(context.Background(), in)
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnauthorized {
		t.Fatalf("got %v, want 401", err)
	}
}

func TestApplicationCreateValidatesRole(t *testing.T) {
	s := &applicationService{}
	actor := middleware.Actor{NUID: "a1", Roles: []models.UserRole{models.UserRoleApplicant}}
	in := &CreateApplicationInput{}
	in.Body.RoleID = "not-a-real-role"

	_, err := s.create(testutil.WithActor(actor), in)
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnprocessableEntity {
		t.Fatalf("got %v, want 422", err)
	}
}

func TestApplicationListAuthorization(t *testing.T) {
	// Every path needs a caller; past that, listing someone else's
	// applications is checked against the database.
	for _, nuid := range []string{"", "a1"} {
		_, err := (&applicationService{}).list(context.Background(), &ListApplicationsInput{UserNUID: nuid})
		testutil.WantStatus(t, err, http.StatusUnauthorized)
	}
}

func TestApplicationGetRequiresActor(t *testing.T) {
	_, err := (&applicationService{}).get(context.Background(), &ApplicationIDInput{ID: "app-1"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}
