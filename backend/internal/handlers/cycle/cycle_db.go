package cycle

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/cyclestaff"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type CycleDB struct {
	db *gorm.DB
}

func NewCycleDB(db *gorm.DB) *CycleDB {
	return &CycleDB{db: db}
}

func (c *CycleDB) CreateCycle(ctx context.Context, in CycleCreate) (models.Cycle, error) {
	cycle := models.Cycle{
		BranchID:        in.BranchID,
		Name:            in.Name,
		Status:          in.Status,
		ApplicationType: in.ApplicationType,
		OpensAt:         in.OpensAt,
		ClosesAt:        in.ClosesAt,
	}
	// Starts with the previous same-type cycle's roles and staff, edited from there.
	err := c.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := utils.Insert(tx, &cycle, "branch_id", "name", "status", "application_type", "opens_at", "closes_at"); err != nil {
			return err
		}
		if err := role.CopyPreviousCycleRoles(tx, cycle.ID); err != nil {
			return err
		}
		if err := workflow.EnsureSteps(tx, cycle.ID); err != nil {
			return err
		}
		return cyclestaff.CopyPreviousCycleStaff(tx, cycle.ID)
	})
	return cycle, err
}

func (c *CycleDB) ListCycles(ctx context.Context, f CycleFilter) ([]models.Cycle, error) {
	cycles := []models.Cycle{}
	return cycles, cyclesQuery(c.db.WithContext(ctx), f).Find(&cycles).Error
}

func cyclesQuery(db *gorm.DB, f CycleFilter) *gorm.DB {
	q := db.Order("created_at DESC")
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.BranchID != "" {
		q = q.Where("branch_id = ?", f.BranchID)
	}
	if f.Listable != nil {
		q = q.Where(f.Listable)
	}
	return q
}

// GetCycle finds the cycle among those the filter allows (ErrNotFound otherwise).
func (c *CycleDB) GetCycle(ctx context.Context, id string, f CycleFilter) (models.Cycle, error) {
	var cycle models.Cycle
	err := cyclesQuery(c.db.WithContext(ctx), f).Where("id = ?", id).Take(&cycle).Error
	return cycle, utils.DBErr(err)
}

// CycleRoleSummary counts a role's questions (including global ones),
// challenges, and submitted applications within a cycle.
func (c *CycleDB) CycleRoleSummary(ctx context.Context, cycleID string, role string) (models.CycleRoleSummary, error) {
	db := c.db.WithContext(ctx)
	var questions, challenges, submissions int64
	err := db.Model(&models.Question{}).
		Where("cycle_id = ? AND (role_id = ? OR role_id IS NULL)", cycleID, role).
		Count(&questions).Error
	if err == nil {
		err = db.Model(&models.CodeChallenge{}).
			Where("cycle_id = ? AND role_id = ?", cycleID, role).
			Count(&challenges).Error
	}
	if err == nil {
		err = db.Model(&models.Application{}).
			Where("cycle_id = ? AND role_id = ? AND stage != ?", cycleID, role, models.StageDraft).
			Count(&submissions).Error
	}
	var script []struct {
		Questions int
		Written   bool
	}
	if err == nil {
		err = db.Raw(`SELECT jsonb_array_length(questions) AS questions,
				(intro_speech <> '' OR jsonb_array_length(questions) > 0) AS written
			FROM interview_script WHERE cycle_id = ? AND role_id = ?`, cycleID, role).Scan(&script).Error
	}
	out := models.CycleRoleSummary{
		RoleID:          role,
		QuestionCount:   int(questions),
		ChallengeCount:  int(challenges),
		SubmissionCount: int(submissions),
	}
	if len(script) > 0 {
		out.ScriptQuestions, out.ScriptWritten = script[0].Questions, script[0].Written
	}
	return out, err
}

func (c *CycleDB) UpdateCycle(ctx context.Context, id string, in CycleUpdate) (models.Cycle, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "name", in.Name)
	utils.SetIf(updates, "status", in.Status)
	utils.SetIf(updates, "application_type", in.ApplicationType)
	utils.SetIf(updates, "opens_at", in.OpensAt)
	utils.SetIf(updates, "closes_at", in.ClosesAt)
	return utils.UpdateReturning[models.Cycle](c.db.WithContext(ctx), updates, "id = ?", id)
}
