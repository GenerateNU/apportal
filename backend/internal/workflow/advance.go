package workflow

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

func complete(db *gorm.DB, cycleID string, s models.Step, now time.Time) error {
	if !s.Valid() {
		return invalid("invalid step")
	}
	return inTx(db, cycleID, func(tx *gorm.DB, f *CycleState) error {
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
	Caller         Caller
	// Verify runs under the cycle lock, so whatever chose these applicants can't change underneath.
	Verify func(tx *gorm.DB) error
	// RejectRest rejects everyone else still in the step for the same openings, in the same batch.
	RejectRest bool
}

type movingApp struct {
	ID     string
	RoleID string
	Stage  models.ApplicationStage
}

func advance(db *gorm.DB, in AdvanceInput, now time.Time) ([]string, Preview, error) {
	if !in.Step.Valid() {
		return nil, Preview{}, invalid("invalid step")
	}
	var apps []movingApp
	var rest []movingApp
	var entry models.ApplicationStage
	var moved []string
	p, err := execute(db, in.CycleID, change{
		preview: func(tx *gorm.DB, f *CycleState) (Preview, error) {
			var p Preview
			if err := f.RequireEnabled(in.Step); err != nil {
				return p, err
			}
			if in.Verify != nil {
				if err := in.Verify(tx); err != nil {
					return p, err
				}
			}
			next, ok := f.Next(in.Step)
			if !ok {
				return p, invalid("%s is the last step", Label(in.Step))
			}
			if entry, ok = EntryStage(next); !ok {
				return p, invalid("applicants reach %s through decision letters, not advance", Label(next))
			}
			if err := tx.Model(&models.Application{}).Select("id, role_id, stage").
				Where("cycle_id = ? AND id IN ?", in.CycleID, in.ApplicationIDs).
				Clauses(clause.Locking{Strength: "UPDATE"}).Scan(&apps).Error; err != nil {
				return p, err
			}
			if len(apps) != len(in.ApplicationIDs) {
				return p, invalid("application_ids must all belong to this cycle")
			}
			byRole := map[string][]string{}
			for _, a := range apps {
				if in.RoleID != "" && a.RoleID != in.RoleID {
					return p, invalid("application %s isn't for role_id %s", a.ID, in.RoleID)
				}
				if !contains(Stages(in.Step), a.Stage) {
					return p, conflict("application %s is in %s, not %s", a.ID, a.Stage, Label(in.Step))
				}
				byRole[a.RoleID] = append(byRole[a.RoleID], a.ID)
				p.Changes = append(p.Changes, PreviewItem{Kind: "advance", ApplicationID: a.ID, Detail: string(entry)})
			}
			pending := map[string][]string{}
			for _, o := range f.Openings {
				if ids, ok := byRole[o.RoleID]; ok && !f.Ready(o.RoleID, in.Step, now) {
					pending[o.RoleID] = ids
				}
			}
			complete, err := completeByRole(tx, f, in.Step, pending)
			if err != nil {
				return p, err
			}
			for _, o := range f.Openings {
				if _, ok := byRole[o.RoleID]; !ok {
					continue
				}
				p.Require(in.Caller.operation(OpAdvance, in.Step, o.RoleID))
				if err := f.AdvanceBlock(o.RoleID, in.Step, now, complete[o.RoleID]); err != nil {
					return p, err
				}
			}
			p.Say(fmt.Sprintf("Move %d applicant(s) from %s to %s", len(apps), Label(in.Step), Label(next)))
			if in.RejectRest && len(byRole) > 0 {
				roles := make([]string, 0, len(byRole))
				for r := range byRole {
					roles = append(roles, r)
				}
				if err := tx.Model(&models.Application{}).Select("id, role_id, stage").
					Where("cycle_id = ? AND role_id IN ? AND stage IN ? AND id NOT IN ?", in.CycleID, roles, Stages(in.Step), in.ApplicationIDs).
					Clauses(clause.Locking{Strength: "UPDATE"}).Scan(&rest).Error; err != nil {
					return p, err
				}
				for _, a := range rest {
					p.Changes = append(p.Changes, PreviewItem{Kind: "reject", ApplicationID: a.ID, Detail: string(models.StageRejected)})
				}
				if len(rest) > 0 {
					p.Say(fmt.Sprintf("Reject the %d not moving on", len(rest)))
				}
			}
			return p, nil
		},
		apply: func(tx *gorm.DB, _ *CycleState, _ Preview) error {
			batch := uuid.NewString()
			rows := make([]models.ApplicationMove, 0, len(apps))
			for _, a := range apps {
				rows = append(rows, models.ApplicationMove{BatchID: batch, ApplicationID: a.ID, FromStage: a.Stage, ToStage: entry, MovedBy: in.Caller.NUID, MovedAt: now})
				moved = append(moved, a.ID)
			}
			rejected := make([]string, 0, len(rest))
			for _, a := range rest {
				rows = append(rows, models.ApplicationMove{BatchID: batch, ApplicationID: a.ID, FromStage: a.Stage, ToStage: models.StageRejected, MovedBy: in.Caller.NUID, MovedAt: now})
				rejected = append(rejected, a.ID)
			}
			if err := tx.Select("batch_id", "application_id", "from_stage", "to_stage", "moved_by", "moved_at").Create(&rows).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.Application{}).Where("id IN ?", moved).Update("stage", entry).Error; err != nil {
				return err
			}
			if len(rejected) > 0 {
				if err := tx.Model(&models.Application{}).Where("id IN ?", rejected).Update("stage", models.StageRejected).Error; err != nil {
					return err
				}
			}
			var left int64
			if err := tx.Model(&models.Application{}).Where("cycle_id = ? AND stage IN ?", in.CycleID, Stages(in.Step)).Count(&left).Error; err != nil {
				return err
			}
			if left == 0 {
				return tx.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ?", in.CycleID, in.Step).Update("completed_at", now).Error
			}
			return nil
		},
	})
	return moved, p, err
}

func contains(stages []models.ApplicationStage, s models.ApplicationStage) bool {
	for _, v := range stages {
		if v == s {
			return true
		}
	}
	return false
}

// reviewsIn is true once an opening's reviews are released and either closed or every applicant has their reviews.
func reviewsIn(db *gorm.DB, cycleID, roleID string, now time.Time) (bool, error) {
	f, err := Load(db, cycleID)
	if err != nil {
		return false, err
	}
	if !f.Released(roleID, models.StepReviews) {
		return false, nil
	}
	if f.Ready(roleID, models.StepReviews, now) {
		return true, nil
	}
	var ids []string
	if err := db.Model(&models.Application{}).Where("cycle_id = ? AND role_id = ? AND stage IN ?", cycleID, roleID, Stages(models.StepReviews)).Pluck("id", &ids).Error; err != nil {
		return false, err
	}
	if len(ids) == 0 {
		return false, nil
	}
	return workComplete(db, f, models.StepReviews, ids)
}

func workComplete(tx *gorm.DB, f *CycleState, s models.Step, ids []string) (bool, error) {
	q, ok := shortOfWork(tx, f, s, ids)
	if !ok {
		return false, nil
	}
	var short int64
	if err := q.Count(&short).Error; err != nil {
		return false, err
	}
	return short == 0, nil
}

func completeByRole(tx *gorm.DB, f *CycleState, s models.Step, byRole map[string][]string) (map[string]bool, error) {
	out := map[string]bool{}
	var ids []string
	for _, r := range byRole {
		ids = append(ids, r...)
	}
	q, ok := shortOfWork(tx, f, s, ids)
	if !ok || len(ids) == 0 {
		return out, nil
	}
	var short []string
	if err := q.Distinct().Pluck("a.role_id", &short).Error; err != nil {
		return nil, err
	}
	for r := range byRole {
		out[r] = true
	}
	for _, r := range short {
		out[r] = false
	}
	return out, nil
}

func shortOfWork(tx *gorm.DB, f *CycleState, s models.Step, ids []string) (*gorm.DB, bool) {
	q := tx.Table("applications a").Where("a.id IN ?", ids)
	switch s {
	case models.StepReviews:
		n := f.Assignments[s][models.KindReviewer]
		if n == 0 {
			return nil, false
		}
		return q.Where("(SELECT count(*) FROM written_reviews w WHERE w.application_id = a.id AND w.submitted_at IS NOT NULL) < ?", n), true
	case models.StepInterviews:
		iv, rec := f.Assignments[s][models.KindInterviewer], f.Assignments[s][models.KindRecordingReviewer]
		if iv == 0 && rec == 0 {
			return nil, false
		}
		conds := tx.Where("FALSE")
		if iv > 0 {
			conds = conds.Or("NOT EXISTS (SELECT 1 FROM interviews i WHERE i.application_id = a.id AND i.submitted_at IS NOT NULL)")
		}
		if rec > 0 {
			conds = conds.Or("(SELECT count(*) FROM interview_reviewers r JOIN interviews i ON i.id = r.interview_id WHERE i.application_id = a.id AND r.writeup_submitted_at IS NOT NULL) < ?", rec)
		}
		return q.Where(conds), true
	}
	return nil, false
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

func undo(db *gorm.DB, cycleID string, s models.Step, roleID string, caller Caller, now time.Time) ([]string, Preview, error) {
	if !s.Valid() {
		return nil, Preview{}, invalid("invalid step")
	}
	var restored, moveIDs []string
	p, err := execute(db, cycleID, change{
		preview: func(tx *gorm.DB, f *CycleState) (Preview, error) {
			var p Preview
			latest := tx.Table("application_moves m").Select("m.batch_id").
				Joins("JOIN applications a ON a.id = m.application_id").
				Where("a.cycle_id = ?", cycleID).Order("m.seq DESC").Limit(1)
			if roleID != "" {
				latest = latest.Where("a.role_id = ?", roleID)
			}
			var batch []string
			if err := latest.Pluck("m.batch_id", &batch).Error; err != nil {
				return p, err
			}
			if len(batch) == 0 {
				return p, conflict("nothing to undo")
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
				return p, err
			}
			c := UndoCandidate{AlreadyUndone: true}
			roles := map[string]bool{}
			for _, r := range rows {
				if r.UndoneAt != nil {
					continue
				}
				c.AlreadyUndone = false
				if to, ok := StepOfStage(r.ToStage); ok {
					if t, _ := TypeOf(to); !t.ByOutcome || c.To == "" {
						c.From, _ = StepOfStage(r.FromStage)
						c.To = to
					}
				}
				c.StageChanged = c.StageChanged || r.Stage != r.ToStage
				if !roles[r.RoleID] {
					roles[r.RoleID] = true
					c.Roles = append(c.Roles, r.RoleID)
				}
				moveIDs = append(moveIDs, r.ID)
				restored = append(restored, r.ApplicationID)
				p.Changes = append(p.Changes, PreviewItem{Kind: "move_back", ApplicationID: r.ApplicationID, Detail: string(r.FromStage)})
			}
			if !c.AlreadyUndone && !c.StageChanged {
				var err error
				if c.HasWork, err = hasWork(tx, c.To, restored); err != nil {
					return p, err
				}
			}
			if err := f.UndoBlock(c, s); err != nil {
				return p, err
			}
			for _, role := range c.Roles {
				p.Require(caller.operation(OpUndo, c.To, role))
			}
			p.Say(fmt.Sprintf("Move %d applicant(s) back from %s to %s", len(restored), Label(c.To), Label(c.From)))
			return p, nil
		},
		apply: func(tx *gorm.DB, _ *CycleState, _ Preview) error {
			if err := tx.Exec(`UPDATE applications a SET stage = m.from_stage FROM application_moves m
				WHERE m.application_id = a.id AND m.id IN ?`, moveIDs).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.ApplicationMove{}).Where("id IN ?", moveIDs).
				Updates(map[string]any{"undone_at": now, "undone_by": caller.NUID}).Error; err != nil {
				return err
			}
			return tx.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ?", cycleID, s).Update("completed_at", nil).Error
		},
	})
	if !p.Applied {
		restored = nil
	}
	return restored, p, err
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

func closeCycle(db *gorm.DB, cycleID string, caller Caller) (models.Cycle, Preview, error) {
	var cycle models.Cycle
	p, err := execute(db, cycleID, change{
		preview: func(_ *gorm.DB, f *CycleState) (Preview, error) {
			var p Preview
			cur, open := f.Current()
			p.Require(caller.operation(OpClose, cur, ""))
			if open {
				p.Say(fmt.Sprintf("Close the cycle while %s is still open; unfinished work stops", Label(cur)))
			} else {
				p.Say("Close the cycle")
			}
			return p, nil
		},
		apply: func(tx *gorm.DB, _ *CycleState, _ Preview) error {
			var err error
			cycle, err = utils.UpdateReturning[models.Cycle](tx, map[string]any{"status": models.CycleClosed}, "id = ?", cycleID)
			return err
		},
	})
	return cycle, p, err
}

// decide ends Decisions for an opening: accepted go to accepted, everyone else still deciding is rejected.
func decide(db *gorm.DB, cycleID, roleID string, accepted []string, caller Caller, now time.Time) ([]string, Preview, error) {
	var apps []movingApp
	keep := map[string]bool{}
	for _, id := range accepted {
		keep[id] = true
	}
	p, err := execute(db, cycleID, change{
		preview: func(tx *gorm.DB, f *CycleState) (Preview, error) {
			var p Preview
			if err := f.RequireEnabled(models.StepDecisions); err != nil {
				return p, err
			}
			if err := tx.Model(&models.Application{}).Select("id, role_id, stage").
				Where("cycle_id = ? AND role_id = ? AND stage IN ?", cycleID, roleID, Stages(models.StepDecisions)).
				Clauses(clause.Locking{Strength: "UPDATE"}).Scan(&apps).Error; err != nil {
				return p, err
			}
			p.Require(caller.operation(OpAdvance, models.StepDecisions, roleID))
			n := 0
			for _, a := range apps {
				to := models.StageRejected
				if keep[a.ID] {
					to, n = models.StageAccepted, n+1
				}
				p.Changes = append(p.Changes, PreviewItem{Kind: "decide", ApplicationID: a.ID, Detail: string(to)})
			}
			p.Say(fmt.Sprintf("Accept %d and reject %d for %s", n, len(apps)-n, f.RoleName(roleID)))
			return p, nil
		},
		apply: func(tx *gorm.DB, _ *CycleState, _ Preview) error {
			if len(apps) == 0 {
				return nil
			}
			batch := uuid.NewString()
			rows := make([]models.ApplicationMove, 0, len(apps))
			var in, out []string
			for _, a := range apps {
				to := models.StageRejected
				if keep[a.ID] {
					to = models.StageAccepted
					in = append(in, a.ID)
				} else {
					out = append(out, a.ID)
				}
				rows = append(rows, models.ApplicationMove{BatchID: batch, ApplicationID: a.ID, FromStage: a.Stage, ToStage: to, MovedBy: caller.NUID, MovedAt: now})
			}
			if err := tx.Select("batch_id", "application_id", "from_stage", "to_stage", "moved_by", "moved_at").Create(&rows).Error; err != nil {
				return err
			}
			for stage, ids := range map[models.ApplicationStage][]string{models.StageAccepted: in, models.StageRejected: out} {
				if len(ids) == 0 {
					continue
				}
				if err := tx.Model(&models.Application{}).Where("id IN ?", ids).Update("stage", stage).Error; err != nil {
					return err
				}
			}
			var left int64
			if err := tx.Model(&models.Application{}).Where("cycle_id = ? AND stage IN ?", cycleID, Stages(models.StepDecisions)).Count(&left).Error; err != nil {
				return err
			}
			if left == 0 {
				return tx.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ?", cycleID, models.StepDecisions).Update("completed_at", now).Error
			}
			return nil
		},
	})
	ids := make([]string, 0, len(apps))
	for _, a := range apps {
		ids = append(ids, a.ID)
	}
	return ids, p, err
}
