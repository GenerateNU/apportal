package cyclestaff

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func TestRemoveStaffClearsOpenWork(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	count := func(sql string, args ...any) int64 {
		t.Helper()
		var n int64
		if err := db.Raw(sql, args...).Scan(&n).Error; err != nil {
			t.Fatal(err)
		}
		return n
	}
	user := func() string {
		n := "t" + uuid.NewString()[:12]
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", n, n+"@test.example", n)
		return n
	}
	lead, chief := user(), user()
	branch, cycle, role, panel, group, slot := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	if err := workflow.EnsureSteps(db, cycle); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer')", role, cycle)
	exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'lead'), (?, ?, 'chief')", cycle, lead, cycle, chief)
	apps := make([]string, 2)
	for i := range apps {
		apps[i] = uuid.NewString()
		exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, ?, 'lead_review', now())", apps[i], cycle, user(), role)
		exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?)", apps[i], lead, chief)
	}
	exec("INSERT INTO written_reviews (application_id, reviewer_nuid, submitted_at) VALUES (?, ?, now())", apps[0], lead)
	exec("INSERT INTO interview_panels (id, cycle_id, name, created_by) VALUES (?, ?, 'P', ?)", panel, cycle, chief)
	exec("INSERT INTO interview_panel_members (panel_id, cycle_id, user_nuid) VALUES (?, ?, ?)", panel, cycle, lead)
	exec("INSERT INTO staff_groups (id, cycle_id, name) VALUES (?, ?, 'G')", group, cycle)
	exec("INSERT INTO staff_group_members (group_id, user_nuid) VALUES (?, ?)", group, lead)
	exec("INSERT INTO meeting_slots (id, cycle_id, label, position) VALUES (?, ?, 'Tue', 0)", slot, cycle)
	exec("INSERT INTO staff_slots (cycle_id, user_nuid, slot_id) VALUES (?, ?, ?)", cycle, lead, slot)

	if err := NewCycleStaffDB(db).RemoveStaff(context.Background(), cycle, lead); err != nil {
		t.Fatal(err)
	}
	if n := count("SELECT count(*) FROM lead_assignments WHERE lead_nuid = ?", lead); n != 1 {
		t.Errorf("kept %d assignments, want only the submitted one", n)
	}
	for table, n := range map[string]int64{
		"interview_panel_members": count("SELECT count(*) FROM interview_panel_members WHERE user_nuid = ?", lead),
		"staff_group_members":     count("SELECT count(*) FROM staff_group_members WHERE user_nuid = ?", lead),
		"staff_slots":             count("SELECT count(*) FROM staff_slots WHERE user_nuid = ?", lead),
	} {
		if n != 0 {
			t.Errorf("%s still has %d rows", table, n)
		}
	}
}
