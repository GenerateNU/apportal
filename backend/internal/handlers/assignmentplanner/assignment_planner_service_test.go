package assignmentplanner

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func chiefContext() context.Context {
	return testutil.WithActor(middleware.Actor{
		NUID:  "chief1",
		Roles: []models.UserRole{models.UserRoleChief},
	})
}

// Like the other handler tests here, these cover only the rejection paths,
// which return before the handler reaches its  The planning logic itself
// is pure and tested directly in internal/assign.

func TestAssignmentPlanCapacityRequiresChief(t *testing.T) {
	s := &assignmentPlannerService{}
	_, err := s.capacity(context.Background(), &CapacityInput{ID: "cycle"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestAssignmentPlanPreviewRequiresChief(t *testing.T) {
	s := &assignmentPlannerService{}
	_, err := s.preview(context.Background(), &PreviewPlanInput{ID: "cycle"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestAssignmentPoolRequiresChief(t *testing.T) {
	s := &assignmentPlannerService{}
	_, err := s.pool(context.Background(), &PoolInput{ID: "cycle", Role: models.RoleSoftwareEngineer})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestAssignmentPlanRejectsInvalidRole(t *testing.T) {
	s := &assignmentPlannerService{}
	ctx := chiefContext()

	in := &CapacityInput{ID: "cycle"}
	in.Body.Role = models.Role("not_a_role")
	in.Body.Coverage = 2
	_, err := s.capacity(ctx, in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

// A preview with no teams has nothing to plan against, and must be rejected
// before the handler queries anything.
func TestAssignmentPlanPreviewRejectsEmptyTeams(t *testing.T) {
	s := &assignmentPlannerService{}
	in := &PreviewPlanInput{ID: "cycle"}
	in.Body.Role = models.RoleSoftwareEngineer
	in.Body.Coverage = 2
	in.Body.Cap = 20

	_, err := s.preview(chiefContext(), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestAssignmentPlanCommitRequiresChief(t *testing.T) {
	s := &assignmentPlannerService{}
	_, err := s.commit(context.Background(), &PreviewPlanInput{ID: "cycle"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

// A lead must not be able to write assignments, even though they can read
// plenty of the review surface.
func TestAssignmentPlanCommitRejectsLead(t *testing.T) {
	s := &assignmentPlannerService{}
	ctx := testutil.WithActor(middleware.Actor{
		NUID:  "lead1",
		Roles: []models.UserRole{models.UserRoleLead},
	})
	_, err := s.commit(ctx, &PreviewPlanInput{ID: "cycle"})
	testutil.WantStatus(t, err, http.StatusForbidden)
}

// Validation must reject before the handler reaches the database, so a malformed
// commit cannot write anything.
func TestAssignmentPlanCommitRejectsEmptyTeams(t *testing.T) {
	s := &assignmentPlannerService{}
	in := &PreviewPlanInput{ID: "cycle"}
	in.Body.Role = models.RoleSoftwareEngineer
	in.Body.Coverage = 2
	in.Body.Cap = 20

	_, err := s.commit(chiefContext(), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}
