package pipeline

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

func (f *Facts) SubmissionBlock(role string, s models.Step, k models.StepKind, admin bool, now time.Time) error {
	if d, ok := f.Deadline(role, s, k); ok && d.Hard && !now.Before(d.DueAt) {
		return huma.Error403Forbidden(fmt.Sprintf("the %s deadline has passed", k))
	}
	return f.Lock(Action{Op: OpSubmit, Step: s, RoleID: role, Admin: admin})
}

func CheckSubmission(db *gorm.DB, cycleID, roleID string, s models.Step, k models.StepKind, admin bool, now time.Time) error {
	f := NewFacts(cycleID)
	var steps []models.CycleStep
	if err := db.Where("cycle_id = ?", cycleID).Find(&steps).Error; err != nil {
		return utils.StoreErr(err)
	}
	for _, st := range steps {
		f.Enabled[st.Step] = st.Enabled
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
	return f.SubmissionBlock(roleID, s, k, admin, now)
}

func CheckApplicationSubmission(db *gorm.DB, applicationID string, s models.Step, k models.StepKind, admin bool, now time.Time) error {
	var app models.Application
	if err := db.Select("cycle_id", "role_id").Where("id = ?", applicationID).Take(&app).Error; err != nil {
		return utils.StoreErr(utils.DBErr(err))
	}
	return CheckSubmission(db, app.CycleID, app.RoleID, s, k, admin, now)
}

func HTTPErr(err error) error {
	var se huma.StatusError
	if err == nil || errors.As(err, &se) {
		return err
	}
	return utils.StoreErr(utils.DBErr(err))
}

type Gate struct {
	db *gorm.DB
}

func NewGate(db *gorm.DB) *Gate { return &Gate{db: db} }

func admin(ctx context.Context) bool {
	actor, _ := middleware.ActorFrom(ctx)
	return actor.HasRole(models.UserRoleAdmin)
}

func (g *Gate) Opening(ctx context.Context, cycleID, roleID string, s models.Step, k models.StepKind) error {
	return CheckSubmission(g.db.WithContext(ctx), cycleID, roleID, s, k, admin(ctx), time.Now())
}

func (g *Gate) Application(ctx context.Context, applicationID string, s models.Step, k models.StepKind) error {
	return CheckApplicationSubmission(g.db.WithContext(ctx), applicationID, s, k, admin(ctx), time.Now())
}
