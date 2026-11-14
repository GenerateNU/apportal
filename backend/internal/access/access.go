// Package access decides what a caller may do with a cycle's data: admins by
// global role, leads and chiefs by their place on that cycle's staff.
package access

import (
	"context"
	"errors"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

// Level is how much of a cycle's data the caller may touch.
type Level int

const (
	None   Level = iota
	Review       // read applications and write reviews
	Manage       // also set up forms and run the pipeline
)

type rule struct {
	types    []models.ApplicationType
	statuses []models.CycleStatus
	level    Level
}

// Nobody sees applications for their own level or above.
var (
	adminRule = rule{
		types:    []models.ApplicationType{models.ApplicationTypeMember, models.ApplicationTypeLead, models.ApplicationTypeChief},
		statuses: []models.CycleStatus{models.CycleDraft, models.CycleOpen},
		level:    Manage,
	}
	staffRules = []struct {
		role models.CycleStaffRole
		rule
	}{
		{models.CycleStaffChief, rule{
			types:    []models.ApplicationType{models.ApplicationTypeMember, models.ApplicationTypeLead},
			statuses: []models.CycleStatus{models.CycleDraft, models.CycleOpen},
			level:    Manage,
		}},
		{models.CycleStaffLead, rule{
			types:    []models.ApplicationType{models.ApplicationTypeMember},
			statuses: []models.CycleStatus{models.CycleOpen},
			level:    Review,
		}},
	}
)

func (r rule) grants(status models.CycleStatus, t models.ApplicationType) Level {
	if contains(r.statuses, status) && contains(r.types, t) {
		return r.level
	}
	return None
}

// LevelFor applies the rules to one caller and cycle. staff is "" when the
// caller isn't on the cycle's staff.
func LevelFor(admin bool, staff models.CycleStaffRole, status models.CycleStatus, t models.ApplicationType) Level {
	if admin {
		return adminRule.grants(status, t)
	}
	for _, s := range staffRules {
		if s.role == staff {
			return s.grants(status, t)
		}
	}
	return None
}

func IsAdmin(actor middleware.Actor) bool {
	return actor.HasRole(models.UserRoleAdmin)
}

// RequireActor 401s without a signed-in caller, before any lookup runs.
func RequireActor(ctx context.Context) error {
	if actor, ok := middleware.ActorFrom(ctx); !ok || actor.NUID == "" {
		return huma.Error401Unauthorized("authentication required")
	}
	return nil
}

// RequireAdmin rejects anyone but a global admin.
func RequireAdmin(ctx context.Context) error {
	if err := RequireActor(ctx); err != nil {
		return err
	}
	if !IsAdmin(utils.CurrentActor(ctx)) {
		return huma.Error403Forbidden("admin role required")
	}
	return nil
}

// A cycle the caller can't see reads as missing, so its existence doesn't leak.
func RequireLevel(have, want Level) error {
	if have == None {
		return huma.Error404NotFound("not found")
	}
	if have < want {
		return huma.Error403Forbidden("chief role required on this cycle")
	}
	return nil
}

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

// CycleLevel is the caller's level on a cycle; None for a missing cycle.
func (c *Checker) CycleLevel(ctx context.Context, cycleID string) (Level, error) {
	return c.level(ctx, func(db *gorm.DB) *gorm.DB {
		return db.Table("cycles c").Where("c.id = ?", cycleID)
	})
}

// ApplicationLevel is the caller's level on the application's cycle.
func (c *Checker) ApplicationLevel(ctx context.Context, applicationID string) (Level, error) {
	return c.level(ctx, func(db *gorm.DB) *gorm.DB {
		return db.Table("applications a").
			Joins("JOIN cycles c ON c.id = a.cycle_id").
			Where("a.id = ?", applicationID)
	})
}

// CycleOfLevel and ApplicationOfLevel resolve the cycle through a row's cycle_id or
// application_id. table is always a constant from the caller, never input.
func (c *Checker) CycleOfLevel(ctx context.Context, table, id string) (Level, error) {
	return c.level(ctx, func(db *gorm.DB) *gorm.DB {
		return db.Table(table+" x").Joins("JOIN cycles c ON c.id = x.cycle_id").Where("x.id = ?", id)
	})
}

func (c *Checker) ApplicationOfLevel(ctx context.Context, table, id string) (Level, error) {
	return c.level(ctx, func(db *gorm.DB) *gorm.DB {
		return db.Table(table+" x").
			Joins("JOIN applications a ON a.id = x.application_id").
			Joins("JOIN cycles c ON c.id = a.cycle_id").
			Where("x.id = ?", id)
	})
}

// from selects the cycle (as alias c) to check.
func (c *Checker) level(ctx context.Context, from func(*gorm.DB) *gorm.DB) (Level, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return None, huma.Error401Unauthorized("authentication required")
	}
	return c.levelOf(ctx, actor, from)
}

// UserCycleLevel is someone else's level on a cycle, e.g. to check a person
// being added to a cycle's work can see it.
func (c *Checker) UserCycleLevel(ctx context.Context, user models.User, cycleID string) (Level, error) {
	return c.levelOf(ctx, middleware.Actor{NUID: user.NUID, Roles: user.Roles}, func(db *gorm.DB) *gorm.DB {
		return db.Table("cycles c").Where("c.id = ?", cycleID)
	})
}

func (c *Checker) levelOf(ctx context.Context, actor middleware.Actor, from func(*gorm.DB) *gorm.DB) (Level, error) {
	var f cycleFacts
	err := from(c.db.WithContext(ctx)).
		Select("c.status, c.application_type, cs.role AS staff_role").
		Joins("LEFT JOIN cycle_staff cs ON cs.cycle_id = c.id AND cs.user_nuid = ?", actor.NUID).
		Take(&f).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return None, nil
	}
	if err != nil {
		return None, utils.StoreErr(err)
	}
	staff := models.CycleStaffRole("")
	if f.StaffRole != nil {
		staff = *f.StaffRole
	}
	return LevelFor(IsAdmin(actor), staff, f.Status, f.ApplicationType), nil
}

// RequireCycle 401s without a caller, 404s on a cycle they can't see and 403s
// when they can see it but need more than they have.
func (c *Checker) RequireCycle(ctx context.Context, cycleID string, want Level) error {
	have, err := c.CycleLevel(ctx, cycleID)
	if err != nil {
		return err
	}
	return RequireLevel(have, want)
}

func (c *Checker) RequireApplication(ctx context.Context, applicationID string, want Level) error {
	have, err := c.ApplicationLevel(ctx, applicationID)
	if err != nil {
		return err
	}
	return RequireLevel(have, want)
}

// ApplicationLevelAtLeast is RequireApplication for callers that also branch
// on the level, e.g. chiefs skipping the blind-review gate.
func (c *Checker) ApplicationLevelAtLeast(ctx context.Context, applicationID string, want Level) (Level, error) {
	have, err := c.ApplicationLevel(ctx, applicationID)
	if err != nil {
		return None, err
	}
	return have, RequireLevel(have, want)
}

// RequireCycleOf checks the cycle of a row in table that has a cycle_id.
func (c *Checker) RequireCycleOf(ctx context.Context, table, id string, want Level) error {
	have, err := c.CycleOfLevel(ctx, table, id)
	if err != nil {
		return err
	}
	return RequireLevel(have, want)
}

// RequireApplicationOf checks the cycle of a row that has an application_id.
func (c *Checker) RequireApplicationOf(ctx context.Context, table, id string, want Level) error {
	have, err := c.ApplicationOfLevel(ctx, table, id)
	if err != nil {
		return err
	}
	return RequireLevel(have, want)
}

// VisibleCycleIDs selects the IDs of cycles where the caller has at least
// want, for filtering lists (`cycle_id IN (?)`). Empty without a caller.
func (c *Checker) VisibleCycleIDs(ctx context.Context, want Level) *gorm.DB {
	actor, _ := middleware.ActorFrom(ctx)
	return visibleCycleIDs(c.db.WithContext(ctx), IsAdmin(actor), actor.NUID, want)
}

func visibleCycleIDs(db *gorm.DB, admin bool, nuid string, want Level) *gorm.DB {
	q := db.Table("cycles c").Select("c.id")
	if admin {
		if adminRule.level < want {
			return q.Where("FALSE")
		}
		return q.Where("c.status IN ?", adminRule.statuses).Where("c.application_type IN ?", adminRule.types)
	}
	q = q.Joins("JOIN cycle_staff cs ON cs.cycle_id = c.id AND cs.user_nuid = ?", nuid)
	conds := db.Where("FALSE")
	for _, s := range staffRules {
		if s.level < want {
			continue
		}
		conds = conds.Or("cs.role = ? AND c.application_type IN ? AND c.status IN ?", s.role, s.types, s.statuses)
	}
	return q.Where(conds)
}

func contains[T comparable](xs []T, x T) bool {
	for _, y := range xs {
		if y == x {
			return true
		}
	}
	return false
}

// RequireApplicant 404s unless the caller has want on a cycle the person
// applied to — for data kept on the person, not one application.
func (c *Checker) RequireApplicant(ctx context.Context, nuid string, want Level) error {
	return c.requireExists(ctx, want, func(db *gorm.DB, visible *gorm.DB) *gorm.DB {
		return db.Table("applications").Where("user_nuid = ? AND cycle_id IN (?)", nuid, visible)
	})
}

// RequireAnyCycle 403s unless the caller has want on at least one cycle.
func (c *Checker) RequireAnyCycle(ctx context.Context, want Level) error {
	err := c.requireExists(ctx, want, func(_ *gorm.DB, visible *gorm.DB) *gorm.DB { return visible })
	var se huma.StatusError
	if errors.As(err, &se) && se.GetStatus() == 404 {
		return huma.Error403Forbidden("staff role required")
	}
	return err
}

func (c *Checker) requireExists(ctx context.Context, want Level, rows func(db, visible *gorm.DB) *gorm.DB) error {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return huma.Error401Unauthorized("authentication required")
	}
	db := c.db.WithContext(ctx)
	var n int64
	if err := rows(db, visibleCycleIDs(db, IsAdmin(actor), actor.NUID, want)).Limit(1).Count(&n).Error; err != nil {
		return utils.StoreErr(err)
	}
	if n == 0 {
		return huma.Error404NotFound("not found")
	}
	return nil
}

// ListableCycles is a condition on cycles for the caller's cycle list: open
// cycles, ones they applied to, and ones they can see as staff. Nil for
// admins, who list every cycle.
func (c *Checker) ListableCycles(ctx context.Context) *gorm.DB {
	actor, _ := middleware.ActorFrom(ctx)
	return listableCycles(c.db.WithContext(ctx), IsAdmin(actor), actor.NUID)
}

func listableCycles(db *gorm.DB, admin bool, nuid string) *gorm.DB {
	if admin {
		return nil
	}
	cond := db.Where("status = ?", models.CycleOpen)
	if nuid == "" {
		return cond
	}
	applied := db.Model(&models.Application{}).Select("cycle_id").Where("user_nuid = ?", nuid)
	return cond.
		Or("id IN (?)", applied).
		Or("id IN (?)", visibleCycleIDs(db, false, nuid, Review))
}

// RequireForm lets staff who can review the cycle read any of its forms, and
// anyone else read a role's form only while it's open in an open cycle, or
// when they applied for that role (to look back at their application).
func (c *Checker) RequireForm(ctx context.Context, cycleID, roleID string) error {
	actor, signedIn := middleware.ActorFrom(ctx)
	signedIn = signedIn && actor.NUID != ""
	if signedIn {
		have, err := c.CycleLevel(ctx, cycleID)
		if err != nil {
			return err
		}
		if have >= Review {
			return nil
		}
	}
	if roleID == "" {
		return huma.Error404NotFound("not found")
	}
	db := c.db.WithContext(ctx)
	var n int64
	if err := openForm(db, cycleID, roleID).Count(&n).Error; err != nil {
		return utils.StoreErr(err)
	}
	if n == 0 && signedIn {
		if err := ownApplication(db, cycleID, roleID, actor.NUID).Count(&n).Error; err != nil {
			return utils.StoreErr(err)
		}
	}
	if n == 0 {
		return huma.Error404NotFound("not found")
	}
	return nil
}

// RequireOpenForm 404s unless the role's form is open in an open cycle, the
// only time anyone can start an application.
func (c *Checker) RequireOpenForm(ctx context.Context, cycleID, roleID string) error {
	if err := RequireActor(ctx); err != nil {
		return err
	}
	var n int64
	if err := openForm(c.db.WithContext(ctx), cycleID, roleID).Count(&n).Error; err != nil {
		return utils.StoreErr(err)
	}
	if n == 0 {
		return huma.Error404NotFound("not found")
	}
	return nil
}

func openForm(db *gorm.DB, cycleID, roleID string) *gorm.DB {
	return db.Table("application_templates at").
		Joins("JOIN cycles c ON c.id = at.cycle_id").
		Where("at.cycle_id = ? AND at.role_id = ?", cycleID, roleID).
		Where("at.status = ? AND c.status = ?", models.CycleOpen, models.CycleOpen)
}

func ownApplication(db *gorm.DB, cycleID, roleID, nuid string) *gorm.DB {
	return db.Model(&models.Application{}).
		Where("cycle_id = ? AND role_id = ? AND user_nuid = ?", cycleID, roleID, nuid)
}

// RequireInterviewRowOf checks a row hanging off an interview (interviewers,
// interview_reviewers). table is a constant from the caller, never input.
func (c *Checker) RequireInterviewRowOf(ctx context.Context, table, id string, want Level) error {
	have, err := c.level(ctx, func(db *gorm.DB) *gorm.DB { return interviewRowCycle(db, table, id) })
	if err != nil {
		return err
	}
	return RequireLevel(have, want)
}

func interviewRowCycle(db *gorm.DB, table, id string) *gorm.DB {
	return db.Table(table+" x").
		Joins("JOIN interviews i ON i.id = x.interview_id").
		Joins("JOIN applications a ON a.id = i.application_id").
		Joins("JOIN cycles c ON c.id = a.cycle_id").
		Where("x.id = ?", id)
}

// VisibleApplicationIDs keeps the ids whose cycle grants the caller want, in
// one query. Hidden and missing ids are dropped, not reported.
func (c *Checker) VisibleApplicationIDs(ctx context.Context, ids []string, want Level) ([]string, error) {
	if err := RequireActor(ctx); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []string{}, nil
	}
	actor, _ := middleware.ActorFrom(ctx)
	out := []string{}
	if err := visibleApplicationIDs(c.db.WithContext(ctx), IsAdmin(actor), actor.NUID, ids, want).Find(&out).Error; err != nil {
		return nil, utils.StoreErr(err)
	}
	return out, nil
}

func visibleApplicationIDs(db *gorm.DB, admin bool, nuid string, ids []string, want Level) *gorm.DB {
	return db.Model(&models.Application{}).Select("id").
		Where("id IN ?", ids).
		Where("cycle_id IN (?)", visibleCycleIDs(db, admin, nuid, want))
}
