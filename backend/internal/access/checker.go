package access

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

// Checker loads the facts access decisions need. Every check 401s without a
// signed-in caller before touching the database.
type Checker struct {
	db *gorm.DB
}

func NewChecker(db *gorm.DB) *Checker {
	return &Checker{db: db}
}

type cycleFacts struct {
	Status          models.CycleStatus
	ApplicationType models.ApplicationType
	StaffRole       *models.CycleStaffRole
}

// applicationFacts repeats cycleFacts' fields: GORM won't scan into an
// unexported embedded struct.
type applicationFacts struct {
	Status            models.CycleStatus
	ApplicationType   models.ApplicationType
	StaffRole         *models.CycleStaffRole
	Owner             bool
	Stage             models.ApplicationStage
	Interviewer       bool
	RecordingReviewer bool
	LeadReviewer      bool
}

func (f cycleFacts) level(actor middleware.Actor) Level {
	staff := models.CycleStaffRole("")
	if f.StaffRole != nil {
		staff = *f.StaffRole
	}
	return LevelFor(IsAdmin(actor), staff, f.Status, f.ApplicationType)
}

const cycleFactColumns = "c.status, c.application_type, cs.role AS staff_role"

func withStaff(q *gorm.DB, nuid string) *gorm.DB {
	return q.Joins("LEFT JOIN cycle_staff cs ON cs.cycle_id = c.id AND cs.user_nuid = ?", nuid)
}

// take runs q, treating a missing row as zero facts (which grant nothing).
func take(q *gorm.DB, dest any) error {
	err := q.Take(dest).Error
	if err == nil || errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	return utils.StoreErr(err)
}

// Cycle is what the caller may do with a cycle.
func (c *Checker) Cycle(ctx context.Context, cycleID string) (CycleAccess, error) {
	return c.cycle(ctx, cycleByID(cycleID))
}

// CycleOf is Cycle for the cycle a row (with a cycle_id) belongs to.
func (c *Checker) CycleOf(ctx context.Context, table, id string) (CycleAccess, error) {
	return c.cycle(ctx, rowCycle(table, id))
}

// UserCycle is what someone else may do with a cycle, e.g. to check a person
// being added to a cycle's work can see it.
func (c *Checker) UserCycle(ctx context.Context, user models.User, cycleID string) (CycleAccess, error) {
	return c.cycleFor(ctx, middleware.Actor{NUID: user.NUID, Roles: user.Roles}, cycleByID(cycleID))
}

func (c *Checker) cycle(ctx context.Context, from cycleQuery) (CycleAccess, error) {
	actor, err := currentActor(ctx)
	if err != nil {
		return CycleAccess{}, err
	}
	return c.cycleFor(ctx, actor, from)
}

func (c *Checker) cycleFor(ctx context.Context, actor middleware.Actor, from cycleQuery) (CycleAccess, error) {
	var f cycleFacts
	q := withStaff(from(c.db.WithContext(ctx)).Select(cycleFactColumns), actor.NUID)
	if err := take(q, &f); err != nil {
		return CycleAccess{}, err
	}
	staff := models.CycleStaffRole("")
	if f.StaffRole != nil {
		staff = *f.StaffRole
	}
	return CycleAccess{level: f.level(actor), admin: IsAdmin(actor), staff: staff}, nil
}

// Application is what the caller may do with an application.
func (c *Checker) Application(ctx context.Context, applicationID string) (ApplicationAccess, error) {
	return c.application(ctx, applicationByID(applicationID))
}

// ApplicationOf is Application for a row with an application_id.
func (c *Checker) ApplicationOf(ctx context.Context, table, id string) (ApplicationAccess, error) {
	return c.application(ctx, rowApplication(table, id))
}

// InterviewRow is Application for a row with an interview_id.
func (c *Checker) InterviewRow(ctx context.Context, table, id string) (ApplicationAccess, error) {
	return c.application(ctx, interviewRowApplication(table, id))
}

func (c *Checker) application(ctx context.Context, from applicationQuery) (ApplicationAccess, error) {
	actor, err := currentActor(ctx)
	if err != nil {
		return ApplicationAccess{}, err
	}
	var f applicationFacts
	if err := take(applicationFactsQuery(c.db.WithContext(ctx), actor.NUID, from), &f); err != nil {
		return ApplicationAccess{}, err
	}
	cycle := cycleFacts{Status: f.Status, ApplicationType: f.ApplicationType, StaffRole: f.StaffRole}
	return ApplicationAccess{
		level:             cycle.level(actor),
		owner:             f.Owner,
		draft:             f.Stage == models.StageDraft,
		interviewer:       f.Interviewer,
		recordingReviewer: f.RecordingReviewer,
		leadReviewer:      f.LeadReviewer,
	}, nil
}

func applicationFactsQuery(db *gorm.DB, nuid string, from applicationQuery) *gorm.DB {
	q := from(db).Select(cycleFactColumns+`, a.user_nuid = ? AS owner, a.stage,
		EXISTS (SELECT 1 FROM interviews ai JOIN interviewers ax ON ax.interview_id = ai.id WHERE ai.application_id = a.id AND ax.interviewer_nuid = ?) AS interviewer,
		EXISTS (SELECT 1 FROM interviews ri JOIN interview_reviewers rx ON rx.interview_id = ri.id WHERE ri.application_id = a.id AND rx.reviewer_nuid = ?) AS recording_reviewer,
		EXISTS (SELECT 1 FROM lead_assignments la WHERE la.application_id = a.id AND la.lead_nuid = ?) AS lead_reviewer`,
		nuid, nuid, nuid, nuid)
	return withStaff(q, nuid)
}

// The Can* checks are the one-call form: load, then check one action.

func (c *Checker) CanCycle(ctx context.Context, action CycleAction, cycleID string) error {
	a, err := c.Cycle(ctx, cycleID)
	if err != nil {
		return err
	}
	return a.Can(action)
}

func (c *Checker) CanCycleOf(ctx context.Context, action CycleAction, table, id string) error {
	a, err := c.CycleOf(ctx, table, id)
	if err != nil {
		return err
	}
	return a.Can(action)
}

func (c *Checker) CanApplication(ctx context.Context, action ApplicationAction, applicationID string) error {
	a, err := c.Application(ctx, applicationID)
	if err != nil {
		return err
	}
	return a.Can(action)
}

func (c *Checker) CanApplicationOf(ctx context.Context, action ApplicationAction, table, id string) error {
	a, err := c.ApplicationOf(ctx, table, id)
	if err != nil {
		return err
	}
	return a.Can(action)
}

func (c *Checker) CanInterviewRow(ctx context.Context, action ApplicationAction, table, id string) error {
	a, err := c.InterviewRow(ctx, table, id)
	if err != nil {
		return err
	}
	return a.Can(action)
}
