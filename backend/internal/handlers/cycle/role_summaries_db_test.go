package cycle

import (
	"context"
	"testing"

	"github.com/google/uuid"

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

	got, err := NewCycleDB(db).CycleRoleSummaries(context.Background(), cycle, []string{eng, design})
	if err != nil {
		t.Fatal(err)
	}
	if got[0].QuestionCount != 2 || got[0].SubmissionCount != 2 {
		t.Errorf("eng: %+v", got[0])
	}
	if got[1].QuestionCount != 1 || got[1].SubmissionCount != 0 {
		t.Errorf("design: %+v", got[1])
	}
}
