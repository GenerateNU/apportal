package application

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

func TestCursorPagingCoversTiesAndDrafts(t *testing.T) {
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
	want := map[string]bool{}
	for i := 0; i < 7; i++ {
		nuid := "t" + uuid.NewString()[:12]
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", nuid, nuid+"@test.example", nuid)
		id := uuid.NewString()
		stage, at := "submitted", "'2026-11-01 12:00:00+00'"
		if i >= 5 {
			stage, at = "lead_review", "NULL"
		}
		exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, ?, ?, "+at+")", id, cycle, nuid, role, stage)
		want[id] = true
	}

	store := NewApplicationDB(db)
	limit := 2
	seen := map[string]bool{}
	var after *utils.Cursor
	for pages := 0; pages < 10; pages++ {
		page, err := store.ListApplicationsPage(context.Background(), ApplicationFilter{CycleID: cycle, Limit: &limit, After: after}, after == nil)
		if err != nil {
			t.Fatal(err)
		}
		for _, a := range page.Items {
			if seen[a.ID] {
				t.Fatalf("%s returned twice", a.ID)
			}
			seen[a.ID] = true
		}
		if page.NextCursor == "" {
			break
		}
		if after, err = utils.ParseCursor(page.NextCursor); err != nil {
			t.Fatal(err)
		}
	}
	if len(seen) != len(want) {
		t.Fatalf("paged %d of %d applications", len(seen), len(want))
	}
}
