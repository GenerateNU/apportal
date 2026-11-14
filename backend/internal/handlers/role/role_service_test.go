package role

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

// These only cover the rejection paths, which return before the handler
// touches the database.

// Who may manage roles depends on the cycle's staff, which needs a database.
var chief = middleware.Actor{NUID: "c1"}

const cycleID = "6f1c2a52-6d2c-4a8e-9a57-2b8f3b1c9d10"

func strPtr(s string) *string { return &s }

func TestRoleCreateRequiresActor(t *testing.T) {
	s := &roleService{}
	in := &CreateRoleInput{}
	in.Body.CycleID = cycleID
	in.Body.Name = "Software Engineer"

	_, err := s.create(context.Background(), in)
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestRoleCreateRequiresName(t *testing.T) {
	s := &roleService{}
	in := &CreateRoleInput{}
	in.Body.CycleID = cycleID
	in.Body.Name = "  "

	_, err := s.create(testutil.WithActor(chief), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestRoleCreateRequiresCycle(t *testing.T) {
	s := &roleService{}
	in := &CreateRoleInput{}
	in.Body.Name = "Software Engineer"

	_, err := s.create(testutil.WithActor(chief), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestRoleUpdateRejectsBlankName(t *testing.T) {
	s := &roleService{}
	in := &UpdateRoleInput{ID: "r1"}
	in.Body.Name = strPtr("")

	_, err := s.update(testutil.WithActor(chief), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestRequireCycleRoleRejectsMissingRole(t *testing.T) {
	err := RequireCycleRole(context.Background(), nil, "cycle", "")
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestRequireCycleRoleRejectsMalformedRole(t *testing.T) {
	err := RequireCycleRole(context.Background(), nil, "cycle", "software_engineer")
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestRoleDeleteRejectsMalformedID(t *testing.T) {
	_, err := (&roleService{}).delete(testutil.WithActor(chief), &RoleIDInput{ID: "r1"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}
