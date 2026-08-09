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

func chiefContext() context.Context {
	return withActor(middleware.Actor{
		NUID:  "chief1",
		Roles: []models.UserRole{models.UserRoleChief},
	})
}

// Like the other handler tests here, these cover only the rejection paths,
// which return before the handler reaches its store. The planning logic itself
// is pure and tested directly in internal/assign.

func wantStatus(t *testing.T, err error, code int) {
	t.Helper()
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != code {
		t.Fatalf("got %v, want %d", err, code)
	}
}

func TestAssignmentPlanCapacityRequiresChief(t *testing.T) {
	h := &assignmentPlannerHandler{}
	_, err := h.capacity(context.Background(), &CapacityInput{ID: "cycle"})
	wantStatus(t, err, http.StatusUnauthorized)
}

func TestAssignmentPlanPreviewRequiresChief(t *testing.T) {
	h := &assignmentPlannerHandler{}
	_, err := h.preview(context.Background(), &PreviewPlanInput{ID: "cycle"})
	wantStatus(t, err, http.StatusUnauthorized)
}

func TestAssignmentPoolRequiresChief(t *testing.T) {
	h := &assignmentPlannerHandler{}
	_, err := h.pool(context.Background(), &PoolInput{ID: "cycle", Role: models.RoleSoftwareEngineer})
	wantStatus(t, err, http.StatusUnauthorized)
}

func TestAssignmentPlanRejectsInvalidRole(t *testing.T) {
	h := &assignmentPlannerHandler{}
	ctx := chiefContext()

	in := &CapacityInput{ID: "cycle"}
	in.Body.Role = models.Role("not_a_role")
	in.Body.Coverage = 2
	_, err := h.capacity(ctx, in)
	wantStatus(t, err, http.StatusUnprocessableEntity)
}

// A preview with no teams has nothing to plan against, and must be rejected
// before the handler queries anything.
func TestAssignmentPlanPreviewRejectsEmptyTeams(t *testing.T) {
	h := &assignmentPlannerHandler{}
	in := &PreviewPlanInput{ID: "cycle"}
	in.Body.Role = models.RoleSoftwareEngineer
	in.Body.Coverage = 2
	in.Body.Cap = 20

	_, err := h.preview(chiefContext(), in)
	wantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestAssignmentPlanCommitRequiresChief(t *testing.T) {
	h := &assignmentPlannerHandler{}
	_, err := h.commit(context.Background(), &PreviewPlanInput{ID: "cycle"})
	wantStatus(t, err, http.StatusUnauthorized)
}

// A lead must not be able to write assignments, even though they can read
// plenty of the review surface.
func TestAssignmentPlanCommitRejectsLead(t *testing.T) {
	h := &assignmentPlannerHandler{}
	ctx := withActor(middleware.Actor{
		NUID:  "lead1",
		Roles: []models.UserRole{models.UserRoleLead},
	})
	_, err := h.commit(ctx, &PreviewPlanInput{ID: "cycle"})
	wantStatus(t, err, http.StatusForbidden)
}

// Validation must reject before the handler reaches the store, so a malformed
// commit cannot write anything.
func TestAssignmentPlanCommitRejectsEmptyTeams(t *testing.T) {
	h := &assignmentPlannerHandler{}
	in := &PreviewPlanInput{ID: "cycle"}
	in.Body.Role = models.RoleSoftwareEngineer
	in.Body.Coverage = 2
	in.Body.Cap = 20

	_, err := h.commit(chiefContext(), in)
	wantStatus(t, err, http.StatusUnprocessableEntity)
}
