package access

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestRequireFormNeedsRoleForApplicants(t *testing.T) {
	c := &Checker{}
	// Signed out and no role: nothing to check against, so it reads as missing.
	testutil.WantStatus(t, c.RequireForm(context.Background(), "c1", ""), http.StatusNotFound)
}

func TestRequireOpenFormWithoutActor(t *testing.T) {
	c := &Checker{}
	testutil.WantStatus(t, c.RequireOpenForm(context.Background(), "c1", "r1"), http.StatusUnauthorized)
}
