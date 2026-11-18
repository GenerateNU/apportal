package workflow

import (
	"fmt"
	"maps"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func setStepEnabled(db *gorm.DB, cycleID string, s models.Step, enabled bool, caller Caller) (Preview, error) {
	if !s.Valid() {
		return Preview{}, invalid("invalid step")
	}
	return execute(db, cycleID, change{
		op: caller.operation(OpToggleStep, s, ""),
		preview: func(_ *gorm.DB, f *CycleState) (Preview, error) {
			var p Preview
			switch {
			case s == models.StepApplications && !enabled:
				return p, invalid("applications can't be turned off")
			case f.Enabled[s] == enabled:
				p.Unchanged = true
				return p, nil
			}
			if t, _ := TypeOf(s); !enabled && !t.ByOutcome && f.StepCount(s) > 0 {
				return p, conflict("%d applicant(s) are still in %s; move them out before turning it off", f.StepCount(s), Label(s))
			}
			next := maps.Clone(f.Enabled)
			next[s] = enabled
			if err := f.ValidateReorder(f.Order, next); err != nil {
				return p, err
			}
			switch {
			case enabled:
				p.Say(fmt.Sprintf("Turn %s on", Label(s)))
			default:
				p.Say(fmt.Sprintf("Turn %s off", Label(s)))
			}
			return p, nil
		},
		apply: func(tx *gorm.DB, _ *CycleState, _ Preview) error {
			return tx.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ?", cycleID, s).Update("enabled", enabled).Error
		},
	})
}

func setAssignment(db *gorm.DB, cycleID string, s models.Step, k models.StepKind, perApplicant *int, caller Caller) (Preview, error) {
	if !s.Valid() || !k.Valid() || !AssignmentKindValid(s, k) {
		return Preview{}, invalid("%s has no %s assignments", s, k)
	}
	if perApplicant != nil && *perApplicant <= 0 {
		return Preview{}, invalid("per_applicant must be positive")
	}
	want := 0
	if perApplicant != nil {
		want = *perApplicant
	}
	return execute(db, cycleID, change{
		op: caller.operation(OpSetAssignment, s, ""),
		preview: func(tx *gorm.DB, f *CycleState) (Preview, error) {
			var p Preview
			if err := f.RequireEnabled(s); err != nil {
				return p, err
			}
			current, set := f.Assignments[s][k]
			if set == (perApplicant != nil) && current == want {
				p.Unchanged = true
				return p, nil
			}
			if perApplicant == nil {
				p.Say(fmt.Sprintf("Stop assigning %ss on %s", k, Label(s)))
			} else {
				p.Say(fmt.Sprintf("%s gets %d %s(s) per applicant", Label(s), want, k))
			}
			return p, planTrim(tx, f, s, k, want, &p)
		},
		apply: func(tx *gorm.DB, _ *CycleState, p Preview) error {
			if err := removeAssignments(tx, k, p.Changes); err != nil {
				return err
			}
			if perApplicant == nil {
				return tx.Where("cycle_id = ? AND step = ? AND kind = ?", cycleID, s, k).Delete(&models.StepAssignment{}).Error
			}
			row := models.StepAssignment{CycleID: cycleID, Step: s, Kind: k, PerApplicant: want}
			return tx.Select("cycle_id", "step", "kind", "per_applicant").Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "cycle_id"}, {Name: "step"}, {Name: "kind"}},
				DoUpdates: clause.AssignmentColumns([]string{"per_applicant"}),
			}).Create(&row).Error
		},
	})
}

type DeadlineInput struct {
	CycleID     string
	RoleID      string
	Step        models.Step
	Kind        models.StepKind
	DueAt       time.Time
	Hard        *bool
	DefaultHard bool
	Caller      Caller
	Now         time.Time
}

func setDeadline(db *gorm.DB, in DeadlineInput) (Preview, error) {
	if !in.Step.Valid() || !in.Kind.Valid() {
		return Preview{}, invalid("invalid step or kind")
	}
	return execute(db, in.CycleID, change{
		preview: func(_ *gorm.DB, f *CycleState) (Preview, error) { return previewDeadline(f, in) },
		apply:   func(tx *gorm.DB, f *CycleState, _ Preview) error { return applyDeadline(tx, f, in) },
	})
}

func clearDeadline(db *gorm.DB, cycleID, roleID string, s models.Step, k models.StepKind, caller Caller, now time.Time) (Preview, error) {
	if !s.Valid() || !k.Valid() {
		return Preview{}, invalid("invalid step or kind")
	}
	return execute(db, cycleID, change{
		preview: func(_ *gorm.DB, f *CycleState) (Preview, error) {
			var p Preview
			if _, ok := f.Deadline(roleID, s, k); !ok {
				p.Unchanged = true
				return p, nil
			}
			if err := f.listsClosedBlock(roleID, s, k, now); err != nil {
				return p, err
			}
			p.Require(caller.operation(OpSetDeadline, s, roleID))
			p.Say(fmt.Sprintf("Remove the %s deadline for %s (%s)", k, Label(s), f.RoleName(roleID)))
			return p, nil
		},
		apply: func(tx *gorm.DB, _ *CycleState, _ Preview) error {
			return tx.Where("cycle_id = ? AND role_id = ? AND step = ? AND kind = ?", cycleID, roleID, s, k).Delete(&models.OpeningDeadline{}).Error
		},
	})
}

func previewDeadline(f *CycleState, in DeadlineInput) (Preview, error) {
	var p Preview
	if err := f.RequireEnabled(in.Step); err != nil {
		return p, err
	}
	if err := f.DeadlineBlock(in.RoleID, in.Step, in.Kind, in.DueAt); err != nil {
		return p, err
	}
	if err := f.listsClosedBlock(in.RoleID, in.Step, in.Kind, in.Now); err != nil {
		return p, err
	}
	op := in.Caller.operation(OpSetDeadline, in.Step, in.RoleID)
	if f.closesEarly(in) {
		op.Level = LevelDestructive
		op.Reason = fmt.Sprintf("This closes %s for %s now, before its deadline", Label(in.Step), f.RoleName(in.RoleID))
		if n := f.Count(in.RoleID, in.Step); n > 0 {
			op.Reason += fmt.Sprintf(". %d %s in it", n, plural(n, "applicant is", "applicants are"))
		}
	}
	p.Require(op)
	p.Say(fmt.Sprintf("Set the %s deadline for %s (%s)", in.Kind, Label(in.Step), f.RoleName(in.RoleID)))
	return p, nil
}

// closesEarly is moving an open step's main deadline to now or earlier, which shuts it straight away.
func (f *CycleState) closesEarly(in DeadlineInput) bool {
	k, ok := MainKind(in.Step)
	return ok && k == in.Kind && f.State(in.RoleID, in.Step, in.Now) == StateOpen && !in.DueAt.After(in.Now)
}

// A passed preference-list deadline is what opens the draft, so it can't move.
func (f *CycleState) listsClosedBlock(role string, s models.Step, k models.StepKind, now time.Time) error {
	if s != models.StepDecisions || k != models.KindPreferenceList {
		return nil
	}
	if d, ok := f.Deadline(role, s, k); ok && !d.DueAt.After(now) {
		return conflict("Preference lists for %s are closed", f.RoleName(role))
	}
	return nil
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}

func applyDeadline(tx *gorm.DB, f *CycleState, in DeadlineInput) error {
	hard := in.DefaultHard
	if d, ok := f.Deadline(in.RoleID, in.Step, in.Kind); ok {
		hard = d.Hard
	}
	if in.Hard != nil {
		hard = *in.Hard
	}
	if err := tx.Exec(`INSERT INTO opening_deadlines (cycle_id, role_id, step, kind, due_at, hard) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (cycle_id, role_id, step, kind) DO UPDATE SET due_at = EXCLUDED.due_at, hard = EXCLUDED.hard`,
		f.CycleID, in.RoleID, in.Step, in.Kind, in.DueAt, hard).Error; err != nil {
		return err
	}
	f.SetDeadline(in.RoleID, in.Step, Deadline{Kind: in.Kind, DueAt: in.DueAt, Hard: hard})
	return nil
}

func release(db *gorm.DB, cycleID, roleID string, s models.Step, caller Caller, now time.Time) (Preview, error) {
	if !s.Valid() {
		return Preview{}, invalid("invalid step")
	}
	return execute(db, cycleID, change{
		preview: func(_ *gorm.DB, f *CycleState) (Preview, error) { return previewRelease(f, roleID, s, caller, now) },
		apply:   func(tx *gorm.DB, f *CycleState, _ Preview) error { return applyRelease(tx, f, roleID, s, caller, now) },
	})
}

func previewRelease(f *CycleState, roleID string, s models.Step, caller Caller, now time.Time) (Preview, error) {
	var p Preview
	if err := f.RequireEnabled(s); err != nil {
		return p, err
	}
	if f.Released(roleID, s) {
		p.Unchanged = true
		return p, nil
	}
	if err := f.ReleaseBlock(roleID, s, now); err != nil {
		return p, err
	}
	p.Require(caller.operation(OpRelease, s, roleID))
	p.Say(fmt.Sprintf("Release %s for %s", Label(s), f.RoleName(roleID)))
	return p, nil
}

func applyRelease(tx *gorm.DB, f *CycleState, roleID string, s models.Step, caller Caller, now time.Time) error {
	row := models.OpeningStep{CycleID: f.CycleID, RoleID: roleID, Step: s, ReleasedAt: &now, ReleasedBy: &caller.NUID}
	if err := tx.Select("cycle_id", "role_id", "step", "released_at", "released_by").Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "cycle_id"}, {Name: "role_id"}, {Name: "step"}},
		DoUpdates: clause.AssignmentColumns([]string{"released_at", "released_by"}),
	}).Create(&row).Error; err != nil {
		return err
	}
	if s == models.StepApplications {
		if err := tx.Model(&models.Cycle{}).Where("id = ? AND status = ?", f.CycleID, models.CycleDraft).Update("status", models.CycleOpen).Error; err != nil {
			return err
		}
	}
	if prev, ok := f.Prev(s); ok && prev == models.StepApplications {
		if err := enterFromApplications(tx, f.CycleID, roleID, s, caller, now); err != nil {
			return err
		}
	}
	f.SetRelease(roleID, s, now)
	return nil
}

func enterFromApplications(tx *gorm.DB, cycleID, roleID string, s models.Step, caller Caller, now time.Time) error {
	entry, ok := EntryStage(s)
	if !ok {
		return nil
	}
	var ids []string
	if err := tx.Model(&models.Application{}).
		Where("cycle_id = ? AND role_id = ? AND stage IN ?", cycleID, roleID, Stages(models.StepApplications)).
		Clauses(clause.Locking{Strength: "UPDATE"}).Pluck("id", &ids).Error; err != nil {
		return err
	}
	if len(ids) == 0 {
		return nil
	}
	batch := uuid.NewString()
	moves := make([]models.ApplicationMove, len(ids))
	for i, id := range ids {
		moves[i] = models.ApplicationMove{BatchID: batch, ApplicationID: id, FromStage: models.StageSubmitted, ToStage: entry, MovedBy: caller.NUID, MovedAt: now}
	}
	if err := tx.Create(&moves).Error; err != nil {
		return err
	}
	if err := tx.Model(&models.Application{}).Where("id IN ?", ids).Update("stage", entry).Error; err != nil {
		return err
	}
	var left int64
	if err := tx.Model(&models.Application{}).Where("cycle_id = ? AND stage IN ?", cycleID, Stages(models.StepApplications)).Count(&left).Error; err != nil {
		return err
	}
	if left > 0 {
		return nil
	}
	return tx.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ? AND completed_at IS NULL", cycleID, models.StepApplications).Update("completed_at", now).Error
}

func unrelease(db *gorm.DB, cycleID, roleID string, s models.Step, caller Caller) (Preview, error) {
	if !s.Valid() {
		return Preview{}, invalid("invalid step")
	}
	return execute(db, cycleID, change{
		preview: func(_ *gorm.DB, f *CycleState) (Preview, error) { return previewUnrelease(f, roleID, s, caller) },
		apply:   func(tx *gorm.DB, f *CycleState, _ Preview) error { return applyUnrelease(tx, f, roleID, s) },
	})
}

func previewUnrelease(f *CycleState, roleID string, s models.Step, caller Caller) (Preview, error) {
	var p Preview
	if !f.Released(roleID, s) {
		p.Unchanged = true
		return p, nil
	}
	p.Require(caller.operation(OpUnrelease, s, roleID))
	p.Say(fmt.Sprintf("Take %s back for %s; assigned people lose access until it's released again", Label(s), f.RoleName(roleID)))
	return p, nil
}

func applyUnrelease(tx *gorm.DB, f *CycleState, roleID string, s models.Step) error {
	if err := tx.Where("cycle_id = ? AND role_id = ? AND step = ?", f.CycleID, roleID, s).Delete(&models.OpeningStep{}).Error; err != nil {
		return err
	}
	delete(f.Releases, key{roleID, s})
	return nil
}
