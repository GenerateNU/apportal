package reviewboard

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

func TestReviewBoardPages(t *testing.T) {
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
		exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, ?, 'lead_review', now())", app, cycle, nuid, role)
		exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?)", app, lead, lead)
	}

	store := NewReviewDB(db)
	seen := map[string]bool{}
	var after *utils.Cursor
	pages := 0
	for {
		apps, next, err := store.ApplicationsPage(context.Background(), cycle, boardStages, 2, after)
		if err != nil {
			t.Fatal(err)
		}
		pages++
		ids := make([]string, len(apps))
		for i, a := range apps {
			if seen[a.ID] {
				t.Fatalf("%s repeated", a.ID)
			}
			seen[a.ID], ids[i] = true, a.ID
		}
		reviewers, err := store.ReviewersFor(context.Background(), ids)
		if err != nil {
			t.Fatal(err)
		}
		if len(reviewers) != len(apps) {
			t.Fatalf("page of %d apps got %d reviewers", len(apps), len(reviewers))
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
