package reviewranking

import (
	"strings"
	"testing"

	"gorm.io/gorm"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

func dryRun(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func wantSQL(t *testing.T, sql string, parts ...string) {
	t.Helper()
	for _, p := range parts {
		if !strings.Contains(sql, p) {
			t.Errorf("sql missing %q:\n%s", p, sql)
		}
	}
}

func TestScoresSQL(t *testing.T) {
	db := dryRun(t)
	var rows []ScoreRow
	st := scoresQuery(db, "c1", "r1").Scan(&rows).Statement
	wantSQL(t, st.SQL.String(), `rq.score_min, rq.score_max, rq.ranked`, `wr.submitted_at IS NOT NULL`, `wra.score IS NOT NULL`, `AND rq.ranked`)
}

func TestDeleteOverridesSQL(t *testing.T) {
	db := dryRun(t).Session(&gorm.Session{SkipDefaultTransaction: true})
	st := deleteOverridesQuery(db, "c1", "r1").Delete(&models.ReviewCutoffOverride{}).Statement
	wantSQL(t, st.SQL.String(),
		`DELETE FROM "review_cutoff_overrides" WHERE application_id IN (SELECT "id" FROM "applications" WHERE cycle_id = $1 AND role_id = $2)`)
}
