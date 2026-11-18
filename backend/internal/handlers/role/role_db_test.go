package role

import (
	"context"
	"errors"
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

func TestDeleteRoleClearsSetupButKeepsApplied(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	branch, cycle, fresh, applied, person := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()[:9]
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'draft', 'member')", cycle, branch)
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Fresh'), (?, ?, 'Applied')", fresh, cycle, applied, cycle)
	testutil.FillOutForm(t, db, cycle, fresh, applied)
	exec("INSERT INTO review_questions (cycle_id, role_id, question_text) VALUES (?, ?, 'Fit?')", cycle, fresh)
	exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, 'A')", person, person+"@test.example")
	exec("INSERT INTO applications (cycle_id, user_nuid, role_id, stage) VALUES (?, ?, ?, 'draft')", cycle, person, applied)

	store := NewRoleDB(db)
	if err := store.DeleteRole(context.Background(), fresh); err != nil {
		t.Fatalf("a position with only setup should delete, got %v", err)
	}
	if err := store.DeleteRole(context.Background(), applied); !errors.Is(err, ErrHasApplications) {
		t.Fatalf("want ErrHasApplications, got %v", err)
	}
	var left int64
	db.Raw("SELECT count(*) FROM roles WHERE id IN (?, ?)", fresh, applied).Scan(&left)
	if left != 1 {
		t.Errorf("want only the applied position left, got %d", left)
	}
}
