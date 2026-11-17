package role

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestRenameRoleRenamesDefaultFormTitle(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	branch, cycle, plain, custom := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'draft', 'member')", cycle, branch)
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Old'), (?, ?, 'Kept')", plain, cycle, custom, cycle)
	exec("INSERT INTO application_templates (cycle_id, role_id, title) VALUES (?, ?, 'Old Application'), (?, ?, 'Join us')", cycle, plain, cycle, custom)

	store := NewRoleDB(db)
	for _, id := range []string{plain, custom} {
		name := "New " + id[:4]
		if _, err := store.UpdateRole(context.Background(), id, RoleUpdate{Name: &name}); err != nil {
			t.Fatal(err)
		}
	}
	title := func(role string) string {
		var s string
		if err := db.Raw("SELECT title FROM application_templates WHERE role_id = ?", role).Scan(&s).Error; err != nil {
			t.Fatal(err)
		}
		return s
	}
	if got := title(plain); got != "New "+plain[:4]+" Application" {
		t.Errorf("default title should follow the rename, got %q", got)
	}
	if got := title(custom); got != "Join us" {
		t.Errorf("custom title should stay, got %q", got)
	}
}
