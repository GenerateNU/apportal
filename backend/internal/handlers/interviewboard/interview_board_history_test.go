package interviewboard

import (
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestBoardHistoryKeepsInterviewedApplicants(t *testing.T) {
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
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer')", role, cycle)
	app := func(stage string, interviewed bool) string {
		n, id := "t"+uuid.NewString()[:12], uuid.NewString()
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", n, n+"@test.example", n)
		exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage) VALUES (?, ?, ?, ?, ?)", id, cycle, n, role, stage)
		if interviewed {
			exec("INSERT INTO interviews (application_id, submitted_at) VALUES (?, now())", id)
		}
		return id
	}
	app("interview", false)
	app("selection", true)
	app("rejected", false)

	now, err := boardApplicants(db, cycle, "", false)
	if err != nil {
		t.Fatal(err)
	}
	all, err := boardApplicants(db, cycle, "", true)
	if err != nil {
		t.Fatal(err)
	}
	if len(now) != 1 || len(all) != 2 {
		t.Fatalf("current %d (want 1), with history %d (want 2)", len(now), len(all))
	}
}
