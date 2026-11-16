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

func TestCheckStaffRoleForType(t *testing.T) {
	cases := []struct {
		name string
		typ  models.ApplicationType
		role models.CycleStaffRole
		want int // 0 for allowed
	}{
		{"lead on member cycle", models.ApplicationTypeMember, models.CycleStaffLead, 0},
		{"chief on member cycle", models.ApplicationTypeMember, models.CycleStaffChief, 0},
		{"chief on lead cycle", models.ApplicationTypeLead, models.CycleStaffChief, 0},
		{"lead on lead cycle", models.ApplicationTypeLead, models.CycleStaffLead, http.StatusUnprocessableEntity},
		{"chief on chief cycle", models.ApplicationTypeChief, models.CycleStaffChief, http.StatusUnprocessableEntity},
		{"lead on chief cycle", models.ApplicationTypeChief, models.CycleStaffLead, http.StatusUnprocessableEntity},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := checkStaffRoleForType(tc.typ, tc.role)
			if tc.want == 0 {
				if err != nil {
					t.Fatalf("want allowed, got %v", err)
				}
				return
			}
			testutil.WantStatus(t, err, tc.want)
		})
	}
}
