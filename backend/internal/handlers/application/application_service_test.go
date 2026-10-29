package application

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

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
	in.Body.Role = models.RoleSoftwareEngineer

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
	in.Body.Role = models.Role("not-a-real-role")

	_, err := s.create(testutil.WithActor(actor), in)
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnprocessableEntity {
		t.Fatalf("got %v, want 422", err)
	}
}

func TestDeadlinePassed(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(time.Hour)

	cases := []struct {
		name string
		tpl  models.ApplicationTemplate
		want bool
	}{
		{"no deadline set", models.ApplicationTemplate{ClosesAt: nil}, false},
		{"deadline in the future", models.ApplicationTemplate{ClosesAt: &future}, false},
		{"deadline in the past", models.ApplicationTemplate{ClosesAt: &past}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := deadlinePassed(tc.tpl); got != tc.want {
				t.Fatalf("deadlinePassed() = %v, want %v", got, tc.want)
			}
		})
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
		{"unscoped, applicant", testutil.WithActor(applicant), "", http.StatusUnauthorized},
		{"scoped to self, no actor", context.Background(), "a1", http.StatusForbidden},
		{"scoped to someone else, applicant", testutil.WithActor(applicant), "someone-else", http.StatusForbidden},
		{"scoped to someone else, no actor", context.Background(), "l1", http.StatusForbidden},
		{"scoped to someone else's nuid but caller is that lead", testutil.WithActor(lead), "someone-else", 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := &applicationService{}
			if tc.wantCode == 0 {
				// A reviewer querying an arbitrary user_nuid passes the
				// authorization gate and proceeds to the database, which needs a
				// real database — not exercised here.
				t.Skip("acceptance path requires a database; see integration tests")
			}
			_, err := s.list(tc.ctx, &ListApplicationsInput{UserNUID: tc.userNUID})
			var se huma.StatusError
			if !errors.As(err, &se) || se.GetStatus() != tc.wantCode {
				t.Fatalf("got %v, want status %d", err, tc.wantCode)
			}
		})
	}
}
