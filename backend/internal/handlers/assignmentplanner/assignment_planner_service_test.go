package assignmentplanner

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func chiefContext() context.Context {
	return testutil.WithActor(middleware.Actor{
		NUID: "chief1",
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
	_, err := s.pool(context.Background(), &PoolInput{ID: "cycle", RoleID: "6f1c2a52-6d2c-4a8e-9a57-2b8f3b1c9d10"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestAssignmentPlanRejectsInvalidRole(t *testing.T) {
	s := &assignmentPlannerService{}
	ctx := chiefContext()

	in := &CapacityInput{ID: "cycle"}
	in.Body.RoleID = "not_a_role"
	in.Body.Coverage = 2
	_, err := s.capacity(ctx, in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

// A preview with no teams has nothing to plan against, and must be rejected
// before the handler queries anything.
func TestAssignmentPlanPreviewRejectsEmptyTeams(t *testing.T) {
	s := &assignmentPlannerService{}
	in := &PreviewPlanInput{ID: "cycle"}
	in.Body.RoleID = "6f1c2a52-6d2c-4a8e-9a57-2b8f3b1c9d10"
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

// Validation must reject before the handler reaches the database, so a malformed
// commit cannot write anything.
func TestAssignmentPlanCommitRejectsEmptyTeams(t *testing.T) {
	s := &assignmentPlannerService{}
	in := &PreviewPlanInput{ID: "cycle"}
	in.Body.RoleID = "6f1c2a52-6d2c-4a8e-9a57-2b8f3b1c9d10"
	in.Body.Coverage = 2
	in.Body.Cap = 20

	_, err := s.commit(chiefContext(), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}
