package cycle

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/cyclestaff"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/utils"
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
		if err := pipeline.EnsureSteps(tx, cycle.ID); err != nil {
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

func (c *CycleDB) CycleRoleSummaries(ctx context.Context, cycleID string, roleIDs []string) ([]models.CycleRoleSummary, error) {
	db := c.db.WithContext(ctx)
	type count struct {
		RoleID *string
		N      int
	}
	grouped := func(q *gorm.DB) (map[string]int, int, error) {
		var rows []count
		if err := q.Select("role_id, count(*) AS n").Group("role_id").Scan(&rows).Error; err != nil {
			return nil, 0, err
		}
		out, global := map[string]int{}, 0
		for _, r := range rows {
			if r.RoleID == nil {
				global = r.N
			} else {
				out[*r.RoleID] = r.N
			}
		}
		return out, global, nil
	}
	questions, globalQuestions, err := grouped(db.Model(&models.Question{}).Where("cycle_id = ?", cycleID))
	if err != nil {
		return nil, err
	}
	challenges, _, err := grouped(db.Model(&models.CodeChallenge{}).Where("cycle_id = ?", cycleID))
	if err != nil {
		return nil, err
	}
	submissions, _, err := grouped(db.Model(&models.Application{}).Where("cycle_id = ? AND stage != ?", cycleID, models.StageDraft))
	if err != nil {
		return nil, err
	}
	var scripts []struct {
		RoleID    string
		Questions int
		Written   bool
	}
	if err := db.Raw(`SELECT role_id, jsonb_array_length(questions) AS questions,
			(intro_speech <> '' OR jsonb_array_length(questions) > 0) AS written
		FROM interview_script WHERE cycle_id = ?`, cycleID).Scan(&scripts).Error; err != nil {
		return nil, err
	}
	out := make([]models.CycleRoleSummary, 0, len(roleIDs))
	for _, id := range roleIDs {
		sum := models.CycleRoleSummary{
			RoleID:          id,
			QuestionCount:   globalQuestions + questions[id],
			ChallengeCount:  challenges[id],
			SubmissionCount: submissions[id],
		}
		for _, sc := range scripts {
			if sc.RoleID == id {
				sum.ScriptQuestions, sum.ScriptWritten = sc.Questions, sc.Written
			}
		}
		out = append(out, sum)
	}
	return out, nil
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
