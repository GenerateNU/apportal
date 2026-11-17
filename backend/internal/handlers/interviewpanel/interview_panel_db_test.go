package interviewpanel

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestAutoCreateInsertsEveryPanelAndMember(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	branch, cycle, chief := uuid.NewString(), uuid.NewString(), "t"+uuid.NewString()[:12]
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, 'Chief')", chief, chief+"@test.example")
	for i := 0; i < 4; i++ {
		n := "t" + uuid.NewString()[:12]
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", n, n+"@test.example", n)
		exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'lead')", cycle, n)
	}

	store := NewInterviewPanelDB(db)
	ids, err := store.AutoCreate(context.Background(), cycle, "", chief, 2)
	if err != nil {
		t.Fatal(err)
	}
	panels, err := store.List(context.Background(), cycle)
	if err != nil {
		t.Fatal(err)
	}
	if len(ids) == 0 || len(panels) != len(ids) {
		t.Fatalf("created %v, listed %d", ids, len(panels))
	}
	members := 0
	for i, p := range panels {
		if p.ID == "" || len(p.Members) == 0 {
			t.Fatalf("panel %d empty: %+v", i, p)
		}
		members += len(p.Members)
	}
	if members != 4 {
		t.Fatalf("%d of 4 staff placed", members)
	}
}
