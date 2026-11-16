package assignmentplanner

import (
	"strings"
	"testing"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
)

func TestReviewersComeBackInOneQuery(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var rows []assignedReviewer
	stmt := reviewersQuery(db, "c1", boardStages).Scan(&rows).Statement
	sql := stmt.SQL.String()
	for _, want := range []string{
		"FROM lead_assignments la",
		"JOIN applications a ON a.id = la.application_id",
		"LEFT JOIN written_reviews wr ON wr.application_id = la.application_id AND wr.reviewer_nuid = la.lead_nuid",
		"a.cycle_id = $1 AND a.stage IN ($2,$3,$4)",
	} {
		if !strings.Contains(sql, want) {
			t.Errorf("sql missing %q:\n%s", want, sql)
		}
	}
}
