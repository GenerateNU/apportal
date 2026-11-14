package branch

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

// These only cover the rejection paths, which return before the handler
// touches the database.

var (
	lead  = middleware.Actor{NUID: "l1", Roles: []models.UserRole{models.UserRoleLead}}
	chief = middleware.Actor{NUID: "c1", Roles: []models.UserRole{models.UserRoleChief}}
)

func strPtr(s string) *string { return &s }

func TestBranchCreateRequiresActor(t *testing.T) {
	s := &branchService{}
	in := &CreateBranchInput{}
	in.Body.Name = "Software"

	_, err := s.create(context.Background(), in)
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestBranchCreateRequiresChief(t *testing.T) {
	s := &branchService{}
	in := &CreateBranchInput{}
	in.Body.Name = "Software"

	_, err := s.create(testutil.WithActor(lead), in)
	testutil.WantStatus(t, err, http.StatusForbidden)
}

func TestBranchCreateRequiresName(t *testing.T) {
	s := &branchService{}
	in := &CreateBranchInput{}
	in.Body.Name = "   "

	_, err := s.create(testutil.WithActor(chief), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestBranchUpdateRequiresChief(t *testing.T) {
	s := &branchService{}
	in := &UpdateBranchInput{ID: "b1"}
	in.Body.Name = strPtr("Design")

	_, err := s.update(testutil.WithActor(lead), in)
	testutil.WantStatus(t, err, http.StatusForbidden)
}

func TestBranchUpdateRejectsBlankName(t *testing.T) {
	s := &branchService{}
	in := &UpdateBranchInput{ID: "b1"}
	in.Body.Name = strPtr("")

	_, err := s.update(testutil.WithActor(chief), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}
