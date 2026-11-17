package cycleworkflow

import (
	"context"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/handlers/leadassignment"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

func TestReviewerProgressForSeveralRolesAtOnce(t *testing.T) {
	f := newFixture(t)
	designer := f.application(f.cycleA, f.roleA2, models.StageSubmitted)
	f.assignReviewer(f.apps[0])
	f.assignReviewer(designer)
	rows, err := leadassignment.NewLeadAssignmentDB(f.db).ListReviewerProgressForCycle(context.Background(), f.cycleA, []string{f.roleA, f.roleA2})
	f.must(err)
	roles := map[string]string{}
	for _, r := range rows {
		roles[r.ApplicationID] = r.RoleID
	}
	if len(rows) != 2 || roles[f.apps[0]] != f.roleA || roles[designer] != f.roleA2 {
		t.Fatalf("one request should cover both roles, tagged by role: %+v", rows)
	}
	only, err := leadassignment.NewLeadAssignmentDB(f.db).ListReviewerProgressForCycle(context.Background(), f.cycleA, []string{f.roleA2})
	f.must(err)
	if len(only) != 1 || only[0].ApplicationID != designer {
		t.Fatalf("a single role stays scoped: %+v", only)
	}
}
