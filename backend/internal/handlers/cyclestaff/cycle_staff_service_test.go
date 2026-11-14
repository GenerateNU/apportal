package cyclestaff

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

// Rejection paths only — they return before touching the database.

var (
	applicant = middleware.Actor{NUID: "u1", Roles: []models.UserRole{models.UserRoleApplicant}}
	admin     = middleware.Actor{NUID: "u2", Roles: []models.UserRole{models.UserRoleAdmin}}
)

func TestSetStaffRequiresActor(t *testing.T) {
	s := &cycleStaffService{}
	in := &SetStaffInput{ID: "c1", NUID: "u3"}
	in.Body.Role = models.CycleStaffLead
	_, err := s.set(context.Background(), in)
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestSetStaffRequiresAdmin(t *testing.T) {
	s := &cycleStaffService{}
	in := &SetStaffInput{ID: "c1", NUID: "u3"}
	in.Body.Role = models.CycleStaffChief
	_, err := s.set(testutil.WithActor(applicant), in)
	testutil.WantStatus(t, err, http.StatusForbidden)
}

func TestSetStaffRejectsUnknownRole(t *testing.T) {
	s := &cycleStaffService{}
	in := &SetStaffInput{ID: "c1", NUID: "u3"}
	in.Body.Role = "member"
	_, err := s.set(testutil.WithActor(admin), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestRemoveStaffRequiresAdmin(t *testing.T) {
	s := &cycleStaffService{}
	_, err := s.remove(testutil.WithActor(applicant), &StaffMemberInput{ID: "c1", NUID: "u3"})
	testutil.WantStatus(t, err, http.StatusForbidden)
}

func TestListStaffRequiresActor(t *testing.T) {
	s := &cycleStaffService{}
	_, err := s.list(context.Background(), &CycleIDInput{ID: "c1"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}
