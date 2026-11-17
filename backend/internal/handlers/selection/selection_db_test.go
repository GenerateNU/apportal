package selection

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

func TestListSelectionsPages(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	branch, cycle, role, lead := uuid.NewString(), uuid.NewString(), uuid.NewString(), "t"+uuid.NewString()[:12]
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Eng')", role, cycle)
	exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, 'Lead')", lead, lead+"@test.example")
	for i := 0; i < 5; i++ {
		nuid, app := "t"+uuid.NewString()[:12], uuid.NewString()
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", nuid, nuid+"@test.example", nuid)
		exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage) VALUES (?, ?, ?, ?, 'selection')", app, cycle, nuid, role)
		exec("INSERT INTO lead_selections (cycle_id, lead_nuid, application_id, created_at) VALUES (?, ?, ?, '2026-01-01')", cycle, lead, app)
	}

	store := NewSelectionDB(db)
	all, next, err := store.ListSelections(context.Background(), cycle, "", 0, nil)
	if err != nil || len(all) != 5 || next != "" {
		t.Fatalf("unpaged: %d rows, next %q, err %v", len(all), next, err)
	}
	seen := map[string]bool{}
	var after *utils.Cursor
	pages := 0
	for {
		rows, next, err := store.ListSelections(context.Background(), cycle, lead, 2, after)
		if err != nil {
			t.Fatal(err)
		}
		pages++
		for _, r := range rows {
			if seen[r.ID] {
				t.Fatalf("%s repeated", r.ID)
			}
			seen[r.ID] = true
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
