package interviewboard

import (
	"context"
	"testing"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

var _ = models.StageDraft

func TestZZPerf(t *testing.T) {
	db := testutil.TestDB(t)
	ctx := context.Background()
	cycle := "00000000-0000-4000-8000-0000000000c1"
	role := "00000000-0000-4000-8000-000000000101"
	_ = pipeline.EnsureSteps(db, cycle)
	_, _ = ctx, role
	time1 := func(name string, f func() error) {
		start := time.Now()
		if err := f(); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		t.Logf("%-38s %6.1fms", name, float64(time.Since(start).Microseconds())/1000)
	}
	time1("interview board rows", func() error {
		rows, err := boardApplicants(db, cycle, "")
		if err != nil {
			return err
		}
		ids := make([]string, len(rows))
		for i, r := range rows {
			ids[i] = r.ApplicationID
		}
		if _, err := boardPeople(db, "interviewers", "interviewer_nuid", "FALSE", ids); err != nil {
			return err
		}
		_, err = boardPeople(db, "interview_reviewers", "reviewer_nuid", "x.writeup_submitted_at IS NOT NULL", ids)
		return err
	})
}
