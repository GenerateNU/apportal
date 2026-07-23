package handlers

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// These only cover the rejection paths, which return before the handler
// touches its store — the acceptance paths need a real database and are
// exercised by integration/manual testing instead.

func TestApplicationCreateRequiresActor(t *testing.T) {
	h := &applicationHandler{}
	in := &CreateApplicationInput{}
	in.Body.Role = models.RoleSoftwareEngineer

	_, err := h.create(context.Background(), in)
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnauthorized {
		t.Fatalf("got %v, want 401", err)
	}
}

func TestApplicationCreateValidatesRole(t *testing.T) {
	h := &applicationHandler{}
	actor := middleware.Actor{NUID: "a1", Roles: []models.UserRole{models.UserRoleApplicant}}
	in := &CreateApplicationInput{}
	in.Body.Role = models.Role("not-a-real-role")

	_, err := h.create(withActor(actor), in)
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnprocessableEntity {
		t.Fatalf("got %v, want 422", err)
	}
}

func TestApplicationListAuthorization(t *testing.T) {
	applicant := middleware.Actor{NUID: "a1", Roles: []models.UserRole{models.UserRoleApplicant}}
	lead := middleware.Actor{NUID: "l1", Roles: []models.UserRole{models.UserRoleLead}}

	cases := []struct {
		name     string
		ctx      context.Context
		userNUID string
		wantCode int
	}{
		{"unscoped, no actor", context.Background(), "", http.StatusUnauthorized},
		{"unscoped, applicant", withActor(applicant), "", http.StatusUnauthorized},
		{"scoped to self, no actor", context.Background(), "a1", http.StatusForbidden},
		{"scoped to someone else, applicant", withActor(applicant), "someone-else", http.StatusForbidden},
		{"scoped to someone else, no actor", context.Background(), "l1", http.StatusForbidden},
		{"scoped to someone else's nuid but caller is that lead", withActor(lead), "someone-else", 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := &applicationHandler{}
			if tc.wantCode == 0 {
				// A reviewer querying an arbitrary user_nuid passes the
				// authorization gate and proceeds to the store, which needs a
				// real database — not exercised here.
				t.Skip("acceptance path requires a database; see integration tests")
			}
			_, err := h.list(tc.ctx, &ListApplicationsInput{UserNUID: tc.userNUID})
			var se huma.StatusError
			if !errors.As(err, &se) || se.GetStatus() != tc.wantCode {
				t.Fatalf("got %v, want status %d", err, tc.wantCode)
			}
		})
	}
}
