package access

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestVisibleApplicationIDsWithoutActor(t *testing.T) {
	c := &Checker{}
	_, err := c.VisibleApplicationIDs(context.Background(), []string{"a1"}, Review)
	testutil.WantStatus(t, err, http.StatusUnauthorized)
	if ids, err := c.VisibleApplicationIDs(testutil.WithActor(middleware.Actor{NUID: "u1"}), nil, Review); err != nil || len(ids) != 0 {
		t.Errorf("no ids should skip the query: %v %v", ids, err)
	}
}

func TestApplicantAndStaffChecksWithoutActor(t *testing.T) {
	c := &Checker{}
	testutil.WantStatus(t, c.RequireApplicant(context.Background(), "u9", Review), http.StatusUnauthorized)
	testutil.WantStatus(t, c.RequireAnyCycle(context.Background(), Review), http.StatusUnauthorized)
}
