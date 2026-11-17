package applicationsummary

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func TestSummarize(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	branch, cycle, role := uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	if err := workflow.EnsureSteps(db, cycle); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer')", role, cycle)
	now := time.Now()
	person := func() string {
		n := "t" + uuid.NewString()[:12]
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", n, n+"@test.example", n)
		return n
	}
	for _, at := range []time.Time{now.Add(-time.Hour), now.Add(-3 * 24 * time.Hour), now.Add(-10 * 24 * time.Hour)} {
		exec("INSERT INTO applications (cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, 'submitted', ?)", cycle, person(), role, at)
	}
	exec("INSERT INTO applications (cycle_id, user_nuid, role_id, stage) VALUES (?, ?, ?, 'draft')", cycle, person(), role)

	got, err := summarize(db, cycle, now)
	if err != nil {
		t.Fatal(err)
	}
	if p := got[0]; p.Submitted != 3 || p.NewDay != 1 || p.NewWeek != 2 {
		t.Fatalf("summary: %+v", p)
	}
}
