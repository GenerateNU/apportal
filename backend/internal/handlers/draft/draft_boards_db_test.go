package draft

import (
	"context"
	"reflect"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestDraftBoardsMatchEachBoard(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	branch, cycle, chief := uuid.NewString(), uuid.NewString(), "t"+uuid.NewString()[:12]
	roles := []string{uuid.NewString(), uuid.NewString(), uuid.NewString()}
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, 'Chief')", chief, chief+"@test.example")
	for i, r := range roles {
		exec("INSERT INTO roles (id, cycle_id, name, created_at) VALUES (?, ?, ?, now() + make_interval(secs => ?))", r, cycle, "Role"+uuid.NewString()[:4], i)
	}
	exec("INSERT INTO preference_lists (cycle_id, name, created_by) VALUES (?, 'Team A', ?), (?, 'Team B', ?)", cycle, chief, cycle, chief)

	store := NewDraftDB(db)
	ctx := context.Background()
	var want []string
	for _, r := range roles[:2] {
		d, err := store.CreateDraft(ctx, cycle, r, 2, chief)
		if err != nil {
			t.Fatal(err)
		}
		want = append(want, d.ID)
	}

	boards, err := store.DraftBoards(ctx, cycle, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(boards) != 2 {
		t.Fatalf("got %d boards, want the 2 opened", len(boards))
	}
	for i, b := range boards {
		if b.ID != want[i] {
			t.Fatalf("board %d is %s, want %s", i, b.ID, want[i])
		}
		one, err := store.DraftBoard(ctx, b.Draft)
		if err != nil {
			t.Fatal(err)
		}
		if len(b.Teams) != 2 || !reflect.DeepEqual(b, one) {
			t.Fatalf("bulk board differs from single:\n%+v\n%+v", b, one)
		}
	}

	only, err := store.DraftBoards(ctx, cycle, []string{roles[1], roles[2]})
	if err != nil {
		t.Fatal(err)
	}
	if len(only) != 1 || only[0].RoleID != roles[1] {
		t.Fatalf("role filter: %+v", only)
	}
}
