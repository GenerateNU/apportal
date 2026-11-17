package interviewboard

import (
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
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

	now, _, err := boardApplicants(db, cycle, "", false, 0, nil)
	if err != nil {
		t.Fatal(err)
	}
	all, _, err := boardApplicants(db, cycle, "", true, 0, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(now) != 1 || len(all) != 2 {
		t.Fatalf("current %d (want 1), with history %d (want 2)", len(now), len(all))
	}
}

func TestBoardApplicantsPages(t *testing.T) {
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
	for i := 0; i < 5; i++ {
		n := "t" + uuid.NewString()[:12]
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, 'Same Name')", n, n+"@test.example")
		exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage) VALUES (?, ?, ?, ?, 'interview')", uuid.NewString(), cycle, n, role)
	}

	seen := map[string]bool{}
	var after *utils.Cursor
	pages := 0
	for {
		rows, next, err := boardApplicants(db, cycle, "", false, 2, after)
		if err != nil {
			t.Fatal(err)
		}
		pages++
		for _, r := range rows {
			if seen[r.ApplicationID] {
				t.Fatalf("%s repeated", r.ApplicationID)
			}
			seen[r.ApplicationID] = true
		}
		if next == "" {
			break
		}
		if after, err = utils.ParseCursor(next); err != nil {
			t.Fatal(err)
		}
	}
	if pages != 3 || len(seen) != 5 {
		t.Fatalf("%d pages covered %d of 5", pages, len(seen))
	}
}
