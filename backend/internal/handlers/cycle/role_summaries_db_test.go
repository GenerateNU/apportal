package cycle

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestCycleRoleSummariesBatched(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	branch, cycle, eng, design := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Eng'), (?, ?, 'Design')", eng, cycle, design, cycle)
	exec(`INSERT INTO questions (cycle_id, role_id, question_text, question_type, display_order, is_required)
		VALUES (?, NULL, 'All', 'short_answer', 1, false), (?, ?, 'Eng only', 'short_answer', 2, false)`, cycle, cycle, eng)
	for _, stage := range []string{"submitted", "lead_review", "draft"} {
		nuid := "t" + uuid.NewString()[:12]
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", nuid, nuid+"@test.example", nuid)
		exec("INSERT INTO applications (cycle_id, user_nuid, role_id, stage) VALUES (?, ?, ?, ?)", cycle, nuid, eng, stage)
	}

	other, otherRole := uuid.NewString(), uuid.NewString()
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Other', 'open', 'member')", other, branch)
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Eng')", otherRole, other)
	exec("INSERT INTO application_templates (cycle_id, role_id, title) VALUES (?, ?, 'Join Eng')", cycle, eng)

	got, err := NewCycleDB(db).CycleRoleSummaries(context.Background(), []string{other, cycle})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 || got[0].RoleID != otherRole || got[0].QuestionCount != 0 {
		t.Fatalf("cycles should come back in the order asked, without each other's counts: %+v", got)
	}
	by := map[string]models.CycleRoleSummary{}
	for _, s := range got {
		by[s.RoleID] = s
	}
	if e := by[eng]; e.QuestionCount != 2 || e.SubmissionCount != 2 || e.Title != "Join Eng" || e.Status != models.CycleDraft {
		t.Errorf("eng: %+v", e)
	}
	if d := by[design]; d.QuestionCount != 1 || d.SubmissionCount != 0 || d.Title != "Design Application" {
		t.Errorf("design: %+v", d)
	}
}
