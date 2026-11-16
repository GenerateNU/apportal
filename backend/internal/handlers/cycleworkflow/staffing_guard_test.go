package cycleworkflow

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestInterviewStaffingFollowsWorkflow(t *testing.T) {
	f := newFixture(t)
	store := interviewassignment.NewInterviewAssignmentDB(f.db)
	guard := staffing.NewGuard()
	add := func(ctx context.Context, app string, kind models.StepKind) error {
		check := func(tx *gorm.DB) error { return guard.CheckAdd(ctx, tx, app, f.leadA.NUID, kind) }
		var err error
		if kind == models.KindInterviewer {
			_, err = store.AddInterviewer(ctx, app, f.leadA.NUID, f.chiefA.NUID, check)
		} else {
			_, err = store.AddReviewer(ctx, app, f.leadA.NUID, f.chiefA.NUID, check)
		}
		return staffing.HTTPError(err)
	}
	remove := func(ctx context.Context, app string) error {
		ivs, err := store.ListInterviewers(ctx, []string{app})
		f.must(err)
		return staffing.HTTPError(store.RemoveInterviewer(ctx, ivs[0].ID, func(tx *gorm.DB, app string) error {
			return guard.CheckRemove(ctx, tx, app, models.KindInterviewer)
		}))
	}
	chief, admin := f.as(f.chiefA), f.confirmed(f.admin)

	app := f.application(f.cycleA, f.roleA, models.StageInterview)
	testutil.WantStatus(t, add(chief, app, models.KindInterviewer), http.StatusConflict)
	if err := guard.CheckAdd(chief, f.db, app, f.leadA.NUID, models.KindInterviewer); !errors.Is(err, staffing.ErrUnset) {
		t.Fatalf("unset interviewer count: %v", err)
	}

	f.exec("INSERT INTO step_assignments (cycle_id, step, kind, per_applicant) VALUES (?, 'interviews', 'interviewer', 1)", f.cycleA)
	testutil.WantStatus(t, add(chief, app, models.KindRecordingReviewer), http.StatusUnprocessableEntity)
	f.must(add(chief, app, models.KindInterviewer))
	f.must(remove(chief, app))
	f.must(add(chief, app, models.KindInterviewer))

	frozen := f.application(f.cycleA, f.roleA2, models.StageInterview)
	f.freeze(f.roleA2, models.StepDecisions)
	testutil.WantStatus(t, add(chief, frozen, models.KindInterviewer), http.StatusConflict)
	f.must(add(admin, frozen, models.KindInterviewer))
	testutil.WantStatus(t, remove(chief, frozen), http.StatusConflict)

	f.freeze(f.roleA, models.StepInterviews)
	testutil.WantStatus(t, remove(chief, app), http.StatusConflict)
	_, err := store.DeleteInterviewersForCycle(chief, f.cycleA, f.roleA, func(tx *gorm.DB) error {
		return guard.CheckOpening(chief, tx, f.cycleA, f.roleA, models.KindInterviewer)
	})
	testutil.WantStatus(t, staffing.HTTPError(err), http.StatusConflict)
	f.must(remove(admin, app))
}

func TestStoredConflictsBlockInterviewers(t *testing.T) {
	f := newFixture(t)
	f.exec("INSERT INTO step_assignments (cycle_id, step, kind, per_applicant) VALUES (?, 'interviews', 'interviewer', 2)", f.cycleA)
	app := f.application(f.cycleA, f.roleA, models.StageInterview)
	f.exec(`INSERT INTO review_conflicts (cycle_id, lead_nuid, applicant_nuid)
		SELECT cycle_id, ?, user_nuid FROM applications WHERE id = ?`, f.leadA.NUID, app)
	err := staffing.NewGuard().CheckAdd(f.as(f.chiefA), f.db, app, f.leadA.NUID, models.KindInterviewer)
	if !errors.Is(err, staffing.ErrConflicted) {
		t.Fatalf("conflicted interviewer: %v", err)
	}
	f.must(staffing.NewGuard().CheckAdd(f.as(f.chiefA), f.db, app, f.chiefA.NUID, models.KindInterviewer))
}
