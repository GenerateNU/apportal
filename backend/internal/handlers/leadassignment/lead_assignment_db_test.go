package leadassignment

import (
	"strings"
	"testing"

	"gorm.io/gorm"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

func TestClearAllKeepsSubmittedReviewers(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	db = db.Session(&gorm.Session{SkipDefaultTransaction: true})
	sql := deleteUnsubmittedQuery(db, "c1", "r1").Delete(&models.LeadAssignment{}).Statement.SQL.String()
	for _, want := range []string{
		"DELETE FROM",
		`application_id IN (SELECT "id" FROM "applications"`,
		"cycle_id = $1 AND role_id = $2",
		"NOT EXISTS (SELECT 1 FROM written_reviews wr",
		"wr.submitted_at IS NOT NULL",
	} {
		if !strings.Contains(sql, want) {
			t.Errorf("sql missing %q:\n%s", want, sql)
		}
	}
}
