package meetingslot

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestReorderSlotsInOneStatement(t *testing.T) {
	db := testutil.TestDB(t)
	branch, cycle := uuid.NewString(), uuid.NewString()
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{"INSERT INTO branches (id, name) VALUES (?, ?)", []any{branch, "test-" + branch}},
		{"INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", []any{cycle, branch}},
	} {
		if err := db.Exec(q.sql, q.args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	ids := []string{uuid.NewString(), uuid.NewString(), uuid.NewString()}
	for i, id := range ids {
		if err := db.Exec("INSERT INTO meeting_slots (id, cycle_id, label, position) VALUES (?, ?, ?, ?)", id, cycle, id[:4], i).Error; err != nil {
			t.Fatal(err)
		}
	}
	want := []string{ids[2], ids[0], ids[1]}
	ok, err := NewMeetingSlotDB(db).Reorder(context.Background(), cycle, want)
	if err != nil || !ok {
		t.Fatalf("reorder: ok=%v err=%v", ok, err)
	}
	var got []string
	if err := db.Raw("SELECT id FROM meeting_slots WHERE cycle_id = ? ORDER BY position", cycle).Scan(&got).Error; err != nil {
		t.Fatal(err)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("order = %v, want %v", got, want)
		}
	}
}
