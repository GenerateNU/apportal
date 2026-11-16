package pipeline

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

func EnsureSteps(db *gorm.DB, cycleID string) error {
	rows := make([]models.CycleStep, 0, len(models.Steps))
	for _, s := range models.Steps {
		rows = append(rows, models.CycleStep{CycleID: cycleID, Step: s, Enabled: true})
	}
	return db.Select("cycle_id", "step", "enabled").Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

func lockCycle(tx *gorm.DB, cycleID string) error {
	if err := EnsureSteps(tx, cycleID); err != nil {
		return err
	}
	var steps []models.CycleStep
	return tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("cycle_id = ?", cycleID).Find(&steps).Error
}

func Load(db *gorm.DB, cycleID string) (*Facts, error) {
	f := NewFacts(cycleID)

	var steps []models.CycleStep
	if err := db.Where("cycle_id = ?", cycleID).Find(&steps).Error; err != nil {
		return nil, err
	}
	for _, s := range steps {
		f.Enabled[s.Step] = s.Enabled
		f.CompletedAt[s.Step] = s.CompletedAt
	}

	var assignments []models.StepAssignment
	if err := db.Where("cycle_id = ?", cycleID).Find(&assignments).Error; err != nil {
		return nil, err
	}
	for _, a := range assignments {
		f.SetAssignment(a.Step, a.Kind, a.PerApplicant)
	}

	if err := db.Model(&models.Role{}).Select("id AS role_id, name").Where("cycle_id = ?", cycleID).
		Order("name").Order("id").Scan(&f.Openings).Error; err != nil {
		return nil, err
	}

	var releases []models.OpeningStep
	if err := db.Where("cycle_id = ? AND released_at IS NOT NULL", cycleID).Find(&releases).Error; err != nil {
		return nil, err
	}
	for _, r := range releases {
		f.SetRelease(r.RoleID, r.Step, *r.ReleasedAt)
	}

	var deadlines []models.OpeningDeadline
	if err := db.Where("cycle_id = ?", cycleID).Find(&deadlines).Error; err != nil {
		return nil, err
	}
	for _, d := range deadlines {
		f.SetDeadline(d.RoleID, d.Step, Deadline{Kind: d.Kind, DueAt: d.DueAt, Hard: d.Hard})
	}

	var moves []struct {
		RoleID  string
		ToStage models.ApplicationStage
	}
	if err := db.Table("application_moves m").Select("a.role_id, m.to_stage").
		Joins("JOIN applications a ON a.id = m.application_id").
		Where("a.cycle_id = ? AND m.undone_at IS NULL", cycleID).
		Group("a.role_id, m.to_stage").Scan(&moves).Error; err != nil {
		return nil, err
	}
	for _, m := range moves {
		f.AddMove(m.RoleID, m.ToStage)
	}

	var counts []struct {
		RoleID string
		Stage  models.ApplicationStage
		N      int
	}
	if err := db.Model(&models.Application{}).Select("role_id, stage, count(*) AS n").
		Where("cycle_id = ?", cycleID).Group("role_id, stage").Scan(&counts).Error; err != nil {
		return nil, err
	}
	for _, c := range counts {
		f.AddCount(c.RoleID, c.Stage, c.N)
	}
	return f, nil
}

func inTx(db *gorm.DB, cycleID string, fn func(tx *gorm.DB, f *Facts) error) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := lockCycle(tx, cycleID); err != nil {
			return err
		}
		f, err := Load(tx, cycleID)
		if err != nil {
			return err
		}
		return fn(tx, f)
	})
}

type Actor struct {
	NUID  string
	Admin bool
}

func SetStepEnabled(db *gorm.DB, cycleID string, s models.Step, enabled bool) error {
	if !s.Valid() {
		return invalid("invalid step")
	}
	return inTx(db, cycleID, func(tx *gorm.DB, f *Facts) error {
		if s == models.StepApplications && !enabled {
			return invalid("applications can't be turned off")
		}
		if f.Enabled[s] == enabled {
			return nil
		}
		if err := f.Lock(Action{Op: OpToggleStep, Step: s}); err != nil {
			return err
		}
		return tx.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ?", cycleID, s).Update("enabled", enabled).Error
	})
}

func SetAssignment(db *gorm.DB, cycleID string, s models.Step, k models.StepKind, perApplicant *int) error {
	if !s.Valid() || !k.Valid() || !AssignmentKindValid(s, k) {
		return invalid("%s has no %s assignments", s, k)
	}
	if perApplicant != nil && *perApplicant <= 0 {
		return invalid("per_applicant must be positive")
	}
	return inTx(db, cycleID, func(tx *gorm.DB, f *Facts) error {
		if err := f.RequireEnabled(s); err != nil {
			return err
		}
		if err := f.Lock(Action{Op: OpSetAssignment, Step: s}); err != nil {
			return err
		}
		if perApplicant == nil {
			return tx.Where("cycle_id = ? AND step = ? AND kind = ?", cycleID, s, k).Delete(&models.StepAssignment{}).Error
		}
		row := models.StepAssignment{CycleID: cycleID, Step: s, Kind: k, PerApplicant: *perApplicant}
		return tx.Select("cycle_id", "step", "kind", "per_applicant").Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "cycle_id"}, {Name: "step"}, {Name: "kind"}},
			DoUpdates: clause.AssignmentColumns([]string{"per_applicant"}),
		}).Create(&row).Error
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
	Actor       Actor
}

func SetDeadline(db *gorm.DB, in DeadlineInput) error {
	if !in.Step.Valid() || !in.Kind.Valid() {
		return invalid("invalid step or kind")
	}
	return inTx(db, in.CycleID, func(tx *gorm.DB, f *Facts) error {
		return setDeadline(tx, f, in)
	})
}

func setDeadline(tx *gorm.DB, f *Facts, in DeadlineInput) error {
	if err := f.RequireEnabled(in.Step); err != nil {
		return err
	}
	if err := f.DeadlineBlock(in.RoleID, in.Step, in.Kind, in.DueAt); err != nil {
		return err
	}
	if err := f.Lock(Action{Op: OpSetDeadline, Step: in.Step, RoleID: in.RoleID, Admin: in.Actor.Admin}); err != nil {
		return err
	}
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

func Release(db *gorm.DB, cycleID, roleID string, s models.Step, actor Actor, now time.Time) error {
	if !s.Valid() {
		return invalid("invalid step")
	}
	return inTx(db, cycleID, func(tx *gorm.DB, f *Facts) error {
		return release(tx, f, roleID, s, actor, now)
	})
}

func release(tx *gorm.DB, f *Facts, roleID string, s models.Step, actor Actor, now time.Time) error {
	if err := f.RequireEnabled(s); err != nil {
		return err
	}
	if f.Released(roleID, s) {
		return nil
	}
	if err := f.Lock(Action{Op: OpRelease, Step: s, RoleID: roleID, Admin: actor.Admin}); err != nil {
		return err
	}
	if err := f.ReleaseBlock(roleID, s, now); err != nil {
		return err
	}
	row := models.OpeningStep{CycleID: f.CycleID, RoleID: roleID, Step: s, ReleasedAt: &now, ReleasedBy: &actor.NUID}
	if err := tx.Select("cycle_id", "role_id", "step", "released_at", "released_by").Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "cycle_id"}, {Name: "role_id"}, {Name: "step"}},
		DoUpdates: clause.AssignmentColumns([]string{"released_at", "released_by"}),
	}).Create(&row).Error; err != nil {
		return err
	}
	f.SetRelease(roleID, s, now)
	return nil
}

func Unrelease(db *gorm.DB, cycleID, roleID string, s models.Step, actor Actor) error {
	if !s.Valid() {
		return invalid("invalid step")
	}
	return inTx(db, cycleID, func(tx *gorm.DB, f *Facts) error {
		return unrelease(tx, f, roleID, s, actor)
	})
}

func unrelease(tx *gorm.DB, f *Facts, roleID string, s models.Step, actor Actor) error {
	if !f.Released(roleID, s) {
		return nil
	}
	if err := f.Lock(Action{Op: OpUnrelease, Step: s, RoleID: roleID, Admin: actor.Admin}); err != nil {
		return err
	}
	if err := tx.Where("cycle_id = ? AND role_id = ? AND step = ?", f.CycleID, roleID, s).Delete(&models.OpeningStep{}).Error; err != nil {
		return err
	}
	delete(f.Releases, key{roleID, s})
	return nil
}

func Complete(db *gorm.DB, cycleID string, s models.Step, now time.Time) error {
	if !s.Valid() {
		return invalid("invalid step")
	}
	return inTx(db, cycleID, func(tx *gorm.DB, f *Facts) error {
		if f.Done(s) {
			return nil
		}
		if err := f.CompleteBlock(s, now); err != nil {
			return err
		}
		return tx.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ?", cycleID, s).Update("completed_at", now).Error
	})
}

type AdvanceInput struct {
	CycleID        string
	Step           models.Step
	RoleID         string
	ApplicationIDs []string
	Actor          Actor
}

type movingApp struct {
	ID     string
	RoleID string
	Stage  models.ApplicationStage
}

func Advance(db *gorm.DB, in AdvanceInput, now time.Time) ([]string, error) {
	if !in.Step.Valid() {
		return nil, invalid("invalid step")
	}
	var moved []string
	err := inTx(db, in.CycleID, func(tx *gorm.DB, f *Facts) error {
		if err := f.RequireEnabled(in.Step); err != nil {
			return err
		}
		next, ok := f.Next(in.Step)
		if !ok {
			return invalid("%s is the last step", Label(in.Step))
		}
		entry, ok := EntryStage(next)
		if !ok {
			return invalid("applicants reach %s through decision letters, not advance", Label(next))
		}

		var apps []movingApp
		if err := tx.Model(&models.Application{}).Select("id, role_id, stage").
			Where("cycle_id = ? AND id IN ?", in.CycleID, in.ApplicationIDs).
			Clauses(clause.Locking{Strength: "UPDATE"}).Scan(&apps).Error; err != nil {
			return err
		}
		if len(apps) != len(in.ApplicationIDs) {
			return invalid("application_ids must all belong to this cycle")
		}
		byRole := map[string][]string{}
		for _, a := range apps {
			if in.RoleID != "" && a.RoleID != in.RoleID {
				return invalid("application %s isn't for role_id %s", a.ID, in.RoleID)
			}
			if !contains(Stages(in.Step), a.Stage) {
				return conflict("application %s is in %s, not %s", a.ID, a.Stage, Label(in.Step))
			}
			byRole[a.RoleID] = append(byRole[a.RoleID], a.ID)
		}
		for _, o := range f.Openings {
			ids, ok := byRole[o.RoleID]
			if !ok {
				continue
			}
			if err := f.Lock(Action{Op: OpAdvance, Step: in.Step, RoleID: o.RoleID, Admin: in.Actor.Admin}); err != nil {
				return err
			}
			complete := false
			if !f.Ready(o.RoleID, in.Step, now) {
				var err error
				if complete, err = workComplete(tx, f, in.Step, ids); err != nil {
					return err
				}
			}
			if err := f.AdvanceBlock(o.RoleID, in.Step, now, complete); err != nil {
				return err
			}
		}

		batch := uuid.NewString()
		rows := make([]models.ApplicationMove, 0, len(apps))
		for _, a := range apps {
			rows = append(rows, models.ApplicationMove{BatchID: batch, ApplicationID: a.ID, FromStage: a.Stage, ToStage: entry, MovedBy: in.Actor.NUID, MovedAt: now})
			moved = append(moved, a.ID)
		}
		if err := tx.Select("batch_id", "application_id", "from_stage", "to_stage", "moved_by", "moved_at").Create(&rows).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Application{}).Where("id IN ?", moved).Update("stage", entry).Error; err != nil {
			return err
		}
		var left int64
		if err := tx.Model(&models.Application{}).Where("cycle_id = ? AND stage IN ?", in.CycleID, Stages(in.Step)).Count(&left).Error; err != nil {
			return err
		}
		if left == 0 {
			return tx.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ?", in.CycleID, in.Step).Update("completed_at", now).Error
		}
		return nil
	})
	return moved, err
}

func contains(stages []models.ApplicationStage, s models.ApplicationStage) bool {
	for _, v := range stages {
		if v == s {
			return true
		}
	}
	return false
}

func workComplete(tx *gorm.DB, f *Facts, s models.Step, ids []string) (bool, error) {
	var short int64
	q := tx.Table("applications a").Where("a.id IN ?", ids)
	switch s {
	case models.StepReviews:
		n := f.Assignments[s][models.KindReviewer]
		if n == 0 {
			return false, nil
		}
		q = q.Where("(SELECT count(*) FROM written_reviews w WHERE w.application_id = a.id AND w.submitted_at IS NOT NULL) < ?", n)
	case models.StepInterviews:
		iv, rec := f.Assignments[s][models.KindInterviewer], f.Assignments[s][models.KindRecordingReviewer]
		if iv == 0 && rec == 0 {
			return false, nil
		}
		conds := tx.Where("FALSE")
		if iv > 0 {
			conds = conds.Or("NOT EXISTS (SELECT 1 FROM interviews i WHERE i.application_id = a.id AND i.submitted_at IS NOT NULL)")
		}
		if rec > 0 {
			conds = conds.Or("(SELECT count(*) FROM interview_reviewers r JOIN interviews i ON i.id = r.interview_id WHERE i.application_id = a.id AND r.writeup_submitted_at IS NOT NULL) < ?", rec)
		}
		q = q.Where(conds)
	default:
		return false, nil
	}
	if err := q.Count(&short).Error; err != nil {
		return false, err
	}
	return short == 0, nil
}

type undoRow struct {
	ID            string
	ApplicationID string
	FromStage     models.ApplicationStage
	ToStage       models.ApplicationStage
	UndoneAt      *time.Time
	RoleID        string
	Stage         models.ApplicationStage
}

func Undo(db *gorm.DB, cycleID string, s models.Step, roleID string, actor Actor, now time.Time) ([]string, error) {
	if !s.Valid() {
		return nil, invalid("invalid step")
	}
	var restored []string
	err := inTx(db, cycleID, func(tx *gorm.DB, f *Facts) error {
		latest := tx.Table("application_moves m").Select("m.batch_id").
			Joins("JOIN applications a ON a.id = m.application_id").
			Where("a.cycle_id = ?", cycleID).Order("m.moved_at DESC").Order("m.batch_id DESC").Limit(1)
		if roleID != "" {
			latest = latest.Where("a.role_id = ?", roleID)
		}
		var batch []string
		if err := latest.Pluck("m.batch_id", &batch).Error; err != nil {
			return err
		}
		if len(batch) == 0 {
			return conflict("nothing to undo")
		}
		q := tx.Table("application_moves m").
			Select("m.id, m.application_id, m.from_stage, m.to_stage, m.undone_at, a.role_id, a.stage").
			Joins("JOIN applications a ON a.id = m.application_id").
			Where("m.batch_id = ?", batch[0]).Clauses(clause.Locking{Strength: "UPDATE"})
		if roleID != "" {
			q = q.Where("a.role_id = ?", roleID)
		}
		var rows []undoRow
		if err := q.Scan(&rows).Error; err != nil {
			return err
		}
		c := UndoCandidate{AlreadyUndone: true}
		var moveIDs []string
		roles := map[string]bool{}
		for _, r := range rows {
			if r.UndoneAt != nil {
				continue
			}
			c.AlreadyUndone = false
			c.From, _ = StepOfStage(r.FromStage)
			c.To, _ = StepOfStage(r.ToStage)
			c.StageChanged = c.StageChanged || r.Stage != r.ToStage
			if !roles[r.RoleID] {
				roles[r.RoleID] = true
				c.Roles = append(c.Roles, r.RoleID)
			}
			moveIDs = append(moveIDs, r.ID)
			restored = append(restored, r.ApplicationID)
		}
		if !c.AlreadyUndone && !c.StageChanged {
			var err error
			if c.HasWork, err = hasWork(tx, c.To, restored); err != nil {
				return err
			}
		}
		if err := f.UndoBlock(c, s); err != nil {
			return err
		}
		for _, role := range c.Roles {
			if err := f.Lock(Action{Op: OpUndo, Step: c.To, RoleID: role, Admin: actor.Admin}); err != nil {
				return err
			}
		}
		if err := tx.Exec(`UPDATE applications a SET stage = m.from_stage FROM application_moves m
			WHERE m.application_id = a.id AND m.id IN ?`, moveIDs).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.ApplicationMove{}).Where("id IN ?", moveIDs).
			Updates(map[string]any{"undone_at": now, "undone_by": actor.NUID}).Error; err != nil {
			return err
		}
		return tx.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ?", cycleID, s).Update("completed_at", nil).Error
	})
	return restored, err
}

var workTables = map[models.Step][]string{
	models.StepReviews:    {"lead_assignments", "written_reviews", "chief_reviews"},
	models.StepInterviews: {"interviews"},
	models.StepDecisions:  {"decision_drafts", "lead_selections"},
}

func hasWork(tx *gorm.DB, s models.Step, ids []string) (bool, error) {
	for _, table := range workTables[s] {
		var n int64
		if err := tx.Table(table).Where("application_id IN ?", ids).Limit(1).Count(&n).Error; err != nil {
			return false, err
		}
		if n > 0 {
			return true, nil
		}
	}
	return false, nil
}

func CloseCycle(db *gorm.DB, cycleID string, admin bool) (models.Cycle, error) {
	var cycle models.Cycle
	err := inTx(db, cycleID, func(tx *gorm.DB, f *Facts) error {
		if !admin && !f.AllDone() {
			cur, _ := f.Current()
			return conflict("%s isn't complete; only an admin can close the cycle early", Label(cur))
		}
		var err error
		cycle, err = utils.UpdateReturning[models.Cycle](tx, map[string]any{"status": models.CycleClosed}, "id = ?", cycleID)
		return err
	})
	return cycle, err
}
