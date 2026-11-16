package application

import (
	"context"
	"testing"
	"time"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

func TestZZPerf(t *testing.T) {
	db := testutil.TestDB(t)
	ctx := context.Background()
	store := NewApplicationDB(db)
	cycle := "00000000-0000-4000-8000-0000000000c1"
	limit := 50
	time1 := func(name string, f func() error) {
		start := time.Now()
		if err := f(); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		t.Logf("%-38s %6.1fms", name, float64(time.Since(start).Microseconds())/1000)
	}
	var next string
	time1("list page 1 + counts", func() error {
		p, err := store.ListApplicationsPage(ctx, ApplicationFilter{CycleID: cycle, Limit: &limit}, true)
		next = p.NextCursor
		return err
	})
	time1("list page 2", func() error {
		c, _ := utils.ParseCursor(next)
		_, err := store.ListApplicationsPage(ctx, ApplicationFilter{CycleID: cycle, Limit: &limit, After: c}, false)
		return err
	})
	time1("list search + counts", func() error {
		_, err := store.ListApplicationsPage(ctx, ApplicationFilter{CycleID: cycle, Limit: &limit, Search: "user 12"}, true)
		return err
	})
	var qid string
	db.Raw("SELECT id FROM questions WHERE cycle_id = ? LIMIT 1", cycle).Scan(&qid)
	time1("list answer filter + counts", func() error {
		_, err := store.ListApplicationsPage(ctx, ApplicationFilter{CycleID: cycle, Limit: &limit,
			AnswerFilters: []AnswerFilter{{QuestionIDs: []string{qid}, Match: MatchContains, Values: []string{"answer 1"}}}}, true)
		return err
	})
	time1("list assigned_to (unpaged)", func() error {
		_, err := store.ListApplications(ctx, ApplicationFilter{CycleID: cycle, AssignedTo: "u10"})
		return err
	})
	time1("list whole cycle (unpaged)", func() error {
		_, err := store.ListApplications(ctx, ApplicationFilter{CycleID: cycle})
		return err
	})
	time1("pipeline.Load", func() error { _, err := pipeline.Load(db, cycle); return err })
	time1("pipeline.LoadTaskCounts", func() error { _, err := pipeline.LoadTaskCounts(db, cycle, "u10"); return err })
}

func TestZZPerfSQL(t *testing.T) {
	db := testutil.TestDB(t)
	cycle := "00000000-0000-4000-8000-0000000000c1"
	var qid string
	db.Raw("SELECT id FROM questions WHERE cycle_id = ? LIMIT 1", cycle).Scan(&qid)
	limit := 50
	f := ApplicationFilter{CycleID: cycle, Limit: &limit, AnswerFilters: []AnswerFilter{{QuestionIDs: []string{qid}, Match: MatchContains, Values: []string{"answer 1"}}}}
	sql := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		var n int64
		return applicationsFrom(tx, f, applicationFilterAll).Distinct("a.id").Count(&n)
	})
	t.Log(sql)
}
