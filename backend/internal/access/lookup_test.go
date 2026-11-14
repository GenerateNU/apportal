package access

import (
	"context"
	"net/http"
	"strings"
	"testing"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
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

func TestApplicationFactsSQL(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var f applicationFacts
	st := applicationFactsQuery(db, "u1", interviewRowApplication("interviewers", "i1")).Take(&f).Statement
	for _, want := range []string{
		`FROM interviewers x`,
		`JOIN interviews i ON i.id = x.interview_id`,
		`JOIN applications a ON a.id = i.application_id`,
		`JOIN cycles c ON c.id = a.cycle_id`,
		`LEFT JOIN cycle_staff cs ON cs.cycle_id = c.id AND cs.user_nuid = $4`,
		`a.user_nuid = $1 AS owner`,
		`EXISTS (SELECT 1 FROM interviews ai JOIN interviewers ax ON ax.interview_id = ai.id WHERE ai.application_id = a.id AND ax.interviewer_nuid = $2) AS interviewer`,
		`EXISTS (SELECT 1 FROM interviews ri JOIN interview_reviewers rx ON rx.interview_id = ri.id WHERE ri.application_id = a.id AND rx.reviewer_nuid = $3) AS recording_reviewer`,
		`x.id = $5`,
	} {
		if !strings.Contains(st.SQL.String(), want) {
			t.Errorf("sql missing %q:\n%s", want, st.SQL.String())
		}
	}
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
