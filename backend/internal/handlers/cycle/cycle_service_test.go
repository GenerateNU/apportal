package cycle

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

var admin = middleware.Actor{NUID: "a1", Roles: []models.UserRole{models.UserRoleAdmin}}

func TestCycleCreateRequiresActor(t *testing.T) {
	s := &cycleService{}
	in := &CreateCycleInput{}
	in.Body.Name = "Fall 2026"
	in.Body.BranchID = "b1"

	_, err := s.create(context.Background(), in)
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestCycleCreateRequiresBranch(t *testing.T) {
	s := &cycleService{}
	in := &CreateCycleInput{}
	in.Body.Name = "Fall 2026"

	_, err := s.create(testutil.WithActor(admin), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}
