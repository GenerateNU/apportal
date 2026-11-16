package decision

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestListDecisionsPages(t *testing.T) {
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
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Eng')", role, cycle)
	var apps []string
	for i := 0; i < 5; i++ {
		nuid, app := "t"+uuid.NewString()[:12], uuid.NewString()
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", nuid, nuid+"@test.example", nuid)
		exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, ?, 'rejected', now())", app, cycle, nuid, role)
		apps = append(apps, app)
	}
	exec("INSERT INTO decision_drafts (application_id, kind, sent_at) VALUES (?, 'rejection_generic', now())", apps[0])

	store := NewDecisionDB(db)
	all, err := store.ListDecisions(context.Background(), DecisionFilter{CycleID: cycle})
	if err != nil {
		t.Fatal(err)
	}
	if len(all.Rows) != 5 || all.Total != 5 || all.StatusCounts[models.DecisionSent] != 1 || all.StatusCounts[models.DecisionReady] != 4 {
		t.Fatalf("all: %d rows, total %d, counts %v", len(all.Rows), all.Total, all.StatusCounts)
	}

	ready := models.DecisionReady
	seen := map[string]bool{}
	for offset := 0; offset < 4; offset += 3 {
		page, err := store.ListDecisions(context.Background(), DecisionFilter{CycleID: cycle, Status: &ready, Limit: 3, Offset: offset})
		if err != nil {
			t.Fatal(err)
		}
		if page.Total != 4 || page.StatusCounts[models.DecisionSent] != 1 {
			t.Fatalf("filtered total %d, counts %v", page.Total, page.StatusCounts)
		}
		for _, r := range page.Rows {
			if r.Status != ready || seen[r.ApplicationID] {
				t.Fatalf("row %+v repeated or wrong status", r)
			}
			seen[r.ApplicationID] = true
		}
	}
	if len(seen) != 4 {
		t.Fatalf("pages covered %d of 4 ready rows", len(seen))
	}
}
