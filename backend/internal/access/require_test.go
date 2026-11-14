package access

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestRequireAdmin(t *testing.T) {
	testutil.WantStatus(t, RequireAdmin(context.Background()), http.StatusUnauthorized)
	applicant := middleware.Actor{NUID: "a1", Roles: []models.UserRole{models.UserRoleApplicant}}
	testutil.WantStatus(t, RequireAdmin(testutil.WithActor(applicant)), http.StatusForbidden)
	admin := middleware.Actor{NUID: "a2", Roles: []models.UserRole{models.UserRoleAdmin}}
	if err := RequireAdmin(testutil.WithActor(admin)); err != nil {
		t.Errorf("admin: %v", err)
	}
}
