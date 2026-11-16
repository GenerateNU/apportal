package workflow

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

func (f *CycleState) SubmissionBlock(role string, s models.Step, k models.StepKind, actor Caller, now time.Time) error {
	op, err := f.submitOp(role, s, k, actor, now)
	if err != nil {
		return err
	}
	return f.EnforcePermission(op)
}

func (f *CycleState) submitOp(role string, s models.Step, k models.StepKind, actor Caller, now time.Time) (Operation, error) {
	a := actor.operation(OpSubmit, s, role)
	if d, ok := f.Deadline(role, s, k); ok && d.Hard && !now.Before(d.DueAt) {
		if !actor.CanOverride() {
			return a, huma.Error403Forbidden(fmt.Sprintf("the %s deadline has passed", k))
		}
		a.Level, a.Reason = LevelOverride, fmt.Sprintf("the %s deadline has passed", k)
	}
	return a, nil
}

func checkSubmission(ctx context.Context, db *gorm.DB, cycleID, roleID string, s models.Step, k models.StepKind, actor Caller, now time.Time) error {
	f := NewCycleState(cycleID)
	var steps []models.CycleStep
	if err := db.Where("cycle_id = ?", cycleID).Order("position").Find(&steps).Error; err != nil {
		return utils.StoreErr(err)
	}
	f.applySteps(steps)
	if err := f.RequireStepRun(s); err != nil {
		return err
	}
	var d []models.OpeningDeadline
	if err := db.Where("cycle_id = ? AND role_id = ? AND step = ? AND kind = ?", cycleID, roleID, s, k).Find(&d).Error; err != nil {
		return utils.StoreErr(err)
	}
	for _, row := range d {
		f.SetDeadline(roleID, s, Deadline{Kind: row.Kind, DueAt: row.DueAt, Hard: row.Hard})
	}
	if next, ok := f.Next(s); ok {
		var started int64
		err := db.Raw(`SELECT count(*) FROM (
			SELECT 1 FROM opening_steps WHERE cycle_id = ? AND role_id = ? AND step = ? AND released_at IS NOT NULL
			UNION ALL
			SELECT 1 FROM application_moves m JOIN applications a ON a.id = m.application_id
			WHERE a.cycle_id = ? AND a.role_id = ? AND m.undone_at IS NULL AND m.to_stage IN ?
		) t`, cycleID, roleID, next, cycleID, roleID, Stages(next)).Scan(&started).Error
		if err != nil {
			return utils.StoreErr(err)
		}
		if started > 0 {
			f.SetRelease(roleID, next, now)
		}
	}
	op, err := f.submitOp(roleID, s, k, actor, now)
	if err != nil {
		return err
	}
	return authorizeOnSuccess(ctx, db, f, op)
}

func checkApplicationSubmission(ctx context.Context, db *gorm.DB, applicationID string, s models.Step, k models.StepKind, now time.Time) error {
	var app models.Application
	if err := db.Select("cycle_id", "role_id").Where("id = ?", applicationID).Take(&app).Error; err != nil {
		return utils.StoreErr(utils.DBErr(err))
	}
	actor, err := CallerOn(ctx, db, app.CycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	return checkSubmission(ctx, db, app.CycleID, app.RoleID, s, k, actor, now)
}

// CallerOn is the one place a request's tier on a cycle is worked out; db may be the caller's transaction.
func CallerOn(ctx context.Context, db *gorm.DB, cycleID string) (Caller, error) {
	tier, err := tierOf(ctx, db, cycleID)
	return callerFrom(ctx, tier), err
}

func HTTPErr(err error) error {
	var se huma.StatusError
	if err == nil || errors.As(err, &se) {
		return err
	}
	return utils.StoreErr(utils.DBErr(err))
}

// Service is the entry point to the workflow for handlers: every check and change goes through it, as the caller.
type Service struct {
	db  *gorm.DB
	now func() time.Time
}

func NewService(db *gorm.DB) *Service { return &Service{db: db, now: time.Now} }

// In runs the Service's checks inside tx, so they hold for the caller's write and record overrides with it.
func (s *Service) In(tx *gorm.DB) *Service {
	c := *s
	c.db = tx
	return &c
}

func (s *Service) WithClock(now func() time.Time) *Service {
	c := *s
	c.now = now
	return &c
}
