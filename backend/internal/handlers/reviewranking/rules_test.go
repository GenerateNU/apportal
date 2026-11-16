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

func TestNextStage(t *testing.T) {
	st := func(stage models.ApplicationStage, order int, active bool) models.CycleStage {
		return models.CycleStage{Stage: stage, DisplayOrder: order, IsActive: active}
	}
	pipeline := func(interviewActive bool) []models.CycleStage {
		return []models.CycleStage{
			st(models.StageSubmitted, 0, true), st(models.StageLeadReview, 1, true), st(models.StageChiefReview, 2, true),
			st(models.StageInterview, 3, interviewActive), st(models.StageInterviewScheduled, 4, true),
			st(models.StageSelection, 5, true), st(models.StageAccepted, 6, true),
		}
	}
	cases := []struct {
		name   string
		stages []models.CycleStage
		want   models.ApplicationStage
		ok     bool
	}{
		{"no stages configured", nil, models.StageInterview, true},
		{"interview enabled", pipeline(true), models.StageInterview, true},
		{"interview off skips to the next enabled step", pipeline(false), models.StageInterviewScheduled, true},
		{"only stages before review left", []models.CycleStage{
			st(models.StageSelection, 0, true), st(models.StageLeadReview, 1, true), st(models.StageAccepted, 2, true),
		}, "", false},
		{"disabled steps are skipped", []models.CycleStage{
			st(models.StageLeadReview, 1, true), st(models.StageInterview, 2, false),
			st(models.StageInterviewScheduled, 3, false), st(models.StageSelection, 4, true),
		}, models.StageSelection, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := nextStage(tc.stages)
			if got != tc.want || ok != tc.ok {
				t.Fatalf("got %q %v, want %q %v", got, ok, tc.want, tc.ok)
			}
		})
	}
}

func TestReviewsInSQL(t *testing.T) {
	db := dryRun(t)
	var in bool
	st := reviewsInQuery(db, "c1", "r1").Scan(&in).Statement
	wantSQL(t, st.SQL.String(),
		`SELECT COALESCE((SELECT review_closes_at <= now() FROM "application_templates" WHERE cycle_id = `,
		`OR (EXISTS (SELECT 1 FROM lead_assignments la JOIN applications a ON a.id = la.application_id WHERE`,
		`AND NOT EXISTS (SELECT 1 FROM lead_assignments la JOIN applications a ON a.id = la.application_id LEFT JOIN written_reviews wr ON wr.application_id = la.application_id AND wr.reviewer_nuid = la.lead_nuid WHERE`,
		`wr.submitted_at IS NULL`,
	)
}

func TestAdvanceSQL(t *testing.T) {
	db := dryRun(t)
	var moved []string
	st := advanceQuery(db, "c1", "r1", []string{"a1", "a2"}, models.StageInterview).Scan(&moved).Statement
	wantSQL(t, st.SQL.String(),
		`UPDATE applications SET stage = $1 WHERE id IN ($2,$3) AND cycle_id = $4 AND role_id = $5 AND stage IN ($6,$7,$8) RETURNING id`)
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
