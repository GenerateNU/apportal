package access

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/testutil"

	"sync"

	"gorm.io/gorm/schema"
)

func TestChecksWithoutActor(t *testing.T) {
	c := &Checker{}
	ctx := context.Background()
	testutil.WantStatus(t, c.CanCycle(ctx, ReviewCycle, "c1"), http.StatusUnauthorized)
	testutil.WantStatus(t, c.CanCycleOf(ctx, ManageCycle, "questions", "q1"), http.StatusUnauthorized)
	testutil.WantStatus(t, c.CanApplication(ctx, ViewApplication, "a1"), http.StatusUnauthorized)
	testutil.WantStatus(t, c.CanApplicationOf(ctx, ManageApplication, "lead_assignments", "l1"), http.StatusUnauthorized)
	testutil.WantStatus(t, c.CanInterviewRow(ctx, ManageApplication, "interviewers", "i1"), http.StatusUnauthorized)
}

// GORM silently skips fields it can't map, which would leave every caller at
// None. Pin that each fact the queries select has somewhere to land.
func TestFactsScanEveryColumn(t *testing.T) {
	for name, dest := range map[string]any{"cycle": &cycleFacts{}, "application": &applicationFacts{}} {
		s, err := schema.Parse(dest, &sync.Map{}, schema.NamingStrategy{})
		if err != nil {
			t.Fatal(err)
		}
		want := []string{"status", "application_type", "staff_role"}
		if name == "application" {
			want = append(want, "owner", "stage", "interviewer", "recording_reviewer")
		}
		for _, col := range want {
			if s.LookUpField(col) == nil {
				t.Errorf("%s facts: nothing scans column %q", name, col)
			}
		}
	}
}
