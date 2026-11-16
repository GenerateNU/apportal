package workflow

import (
	"context"
	"errors"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

type Tier int

const (
	TierNone Tier = iota
	TierLead
	TierChief
	TierAdmin
)

func (t Tier) role() string {
	switch t {
	case TierAdmin:
		return "admin"
	case TierChief:
		return "chief"
	}
	return "lead"
}

func tierFor(admin bool, staff models.CycleStaffRole) Tier {
	switch {
	case admin:
		return TierAdmin
	case staff == models.CycleStaffChief:
		return TierChief
	case staff == models.CycleStaffLead:
		return TierLead
	}
	return TierNone
}

type Level string

const (
	LevelNormal      Level = "normal"
	LevelOverride    Level = "override"
	LevelDestructive Level = "destructive"
)

func (l Level) rank() int {
	switch l {
	case LevelOverride:
		return 1
	case LevelDestructive:
		return 2
	}
	return 0
}

func maxLevel(a, b Level) Level {
	if b.rank() > a.rank() {
		return b
	}
	return a
}

type PermissionResult struct {
	Allowed      bool   `json:"allowed"`
	Level        Level  `json:"level" enum:"normal,override,destructive"`
	NeedsConfirm bool   `json:"needs_confirm,omitempty"`
	Reason       string `json:"reason,omitempty"`
}

// Level an action takes when the workflow would otherwise block it.
var operationLevel = map[Op]Level{
	OpSubmit:         LevelOverride,
	OpAssign:         LevelOverride,
	OpMove:           LevelOverride,
	OpSetDeadline:    LevelOverride,
	OpRelease:        LevelOverride,
	OpAdvance:        LevelOverride,
	OpSetAssignment:  LevelOverride,
	OpReleaseReviews: LevelOverride,
	OpEditSetup:      LevelOverride,
	OpUnrelease:      LevelDestructive,
	OpUndo:           LevelDestructive,
	OpToggleStep:     LevelDestructive,
	OpClose:          LevelDestructive,
}

const OpClose Op = "close"

type Caller struct {
	NUID   string
	Tier   Tier
	Intent middleware.Intent
}

func (a Caller) CanOverride() bool { return a.Tier >= TierChief }

func (a Caller) operation(op Op, s models.Step, roleID string) Operation {
	return Operation{Op: op, Step: s, RoleID: roleID, Caller: a}
}

// CheckPermission is the one place workflow state, the action's level and the caller's tier meet.
// Leads are never offered an override; chiefs and admins must confirm anything above normal.
func (f *CycleState) CheckPermission(a Operation) PermissionResult {
	block := f.blocker(a)
	level := maxLevel(LevelNormal, a.Level)
	if block != nil {
		level = maxLevel(level, maxLevel(LevelOverride, operationLevel[a.Op]))
	}
	if level == LevelNormal {
		return PermissionResult{Allowed: true, Level: LevelNormal}
	}
	reason := a.Reason
	if block != nil {
		reason = errMessage(block)
	}
	switch {
	case !a.Caller.CanOverride():
		return PermissionResult{Level: level, Reason: reason}
	case !a.Caller.Intent.Confirm:
		return PermissionResult{Level: level, NeedsConfirm: true, Reason: reason}
	}
	return PermissionResult{Allowed: true, Level: level, Reason: reason}
}

func (f *CycleState) EnforcePermission(a Operation) error {
	d := f.CheckPermission(a)
	switch {
	case d.Allowed:
		return nil
	case d.NeedsConfirm:
		return overrideRequired(d)
	}
	if block := f.blocker(a); block != nil {
		return block
	}
	return huma.Error403Forbidden(d.Reason)
}

func recordOverride(tx *gorm.DB, cycleID string, a Operation, d PermissionResult, plan *Preview) error {
	row := models.WorkflowOverride{
		CycleID: cycleID, RoleID: nullable(a.RoleID), Step: a.Step, Op: string(a.Op),
		Level: string(d.Level), ActorNUID: a.Caller.NUID, Reason: d.Reason,
	}
	if plan != nil {
		row.Plan = plan.json()
	}
	return tx.Create(&row).Error
}

func overrideRequired(d PermissionResult) error {
	return huma.Error409Conflict(string(d.Level)+" change needs confirmation: "+d.Reason,
		&huma.ErrorDetail{Location: "query.confirm_override", Message: d.Reason, Value: d.Level})
}

func errMessage(err error) string {
	var m *huma.ErrorModel
	if errors.As(err, &m) {
		return m.Detail
	}
	return err.Error()
}

func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func tierOf(ctx context.Context, db *gorm.DB, cycleID string) (Tier, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok {
		return TierNone, nil
	}
	if actor.HasRole(models.UserRoleAdmin) {
		return TierAdmin, nil
	}
	var roles []models.CycleStaffRole
	err := db.Model(&models.CycleStaff{}).Where("cycle_id = ? AND user_nuid = ?", cycleID, actor.NUID).Pluck("role", &roles).Error
	if err != nil || len(roles) == 0 {
		return TierNone, err
	}
	return tierFor(false, roles[0]), nil
}

func callerFrom(ctx context.Context, tier Tier) Caller {
	actor, _ := middleware.ActorFrom(ctx)
	return Caller{NUID: actor.NUID, Tier: tier, Intent: middleware.IntentFrom(ctx)}
}
