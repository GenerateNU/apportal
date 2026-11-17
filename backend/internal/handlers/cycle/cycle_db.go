package cycle

import (
	"context"
	"slices"
	"time"

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

// CycleRoleSummaries reports every role of the given cycles, in cycle order then role order.
func (c *CycleDB) CycleRoleSummaries(ctx context.Context, cycleIDs []string) ([]models.CycleRoleSummary, error) {
	db := c.db.WithContext(ctx)
	out := []models.CycleRoleSummary{}
	if len(cycleIDs) == 0 {
		return out, nil
	}
	if err := db.Table("roles r").
		Select("r.cycle_id, r.id AS role_id, COALESCE(at.title, r.name || ' Application') AS title").
		Joins("LEFT JOIN application_templates at ON at.cycle_id = r.cycle_id AND at.role_id = r.id").
		Where("r.cycle_id IN ?", cycleIDs).
		Order("r.created_at").Order("r.name").
		Scan(&out).Error; err != nil {
		return nil, err
	}
	slices.SortStableFunc(out, func(a, b models.CycleRoleSummary) int {
		return slices.Index(cycleIDs, a.CycleID) - slices.Index(cycleIDs, b.CycleID)
	})
	type count struct {
		CycleID string
		RoleID  *string
		N       int
	}
	type at struct{ cycle, role string }
	grouped := func(q *gorm.DB) (map[at]int, error) {
		var rows []count
		if err := q.Select("cycle_id, role_id, count(*) AS n").Where("cycle_id IN ?", cycleIDs).Group("cycle_id, role_id").Scan(&rows).Error; err != nil {
			return nil, err
		}
		m := map[at]int{}
		for _, r := range rows {
			role := ""
			if r.RoleID != nil {
				role = *r.RoleID
			}
			m[at{r.CycleID, role}] = r.N
		}
		return m, nil
	}
	questions, err := grouped(db.Model(&models.Question{}))
	if err != nil {
		return nil, err
	}
	challenges, err := grouped(db.Model(&models.CodeChallenge{}))
	if err != nil {
		return nil, err
	}
	submissions, err := grouped(db.Model(&models.Application{}).Where("stage != ?", models.StageDraft))
	if err != nil {
		return nil, err
	}
	var scripts []struct {
		CycleID   string
		RoleID    string
		Questions int
		Written   bool
	}
	if err := db.Raw(`SELECT cycle_id, role_id, jsonb_array_length(questions) AS questions,
			(intro_speech <> '' OR jsonb_array_length(questions) > 0) AS written
		FROM interview_script WHERE cycle_id IN ?`, cycleIDs).Scan(&scripts).Error; err != nil {
		return nil, err
	}
	script := map[at]int{}
	for i, sc := range scripts {
		script[at{sc.CycleID, sc.RoleID}] = i
	}
	templates := make([]models.ApplicationTemplate, len(out))
	for i, sum := range out {
		templates[i] = models.ApplicationTemplate{CycleID: sum.CycleID, RoleID: sum.RoleID}
	}
	if err := workflow.FillTemplates(db, templates, time.Now()); err != nil {
		return nil, err
	}
	for i := range out {
		sum := &out[i]
		k := at{sum.CycleID, sum.RoleID}
		sum.QuestionCount = questions[at{sum.CycleID, ""}] + questions[k]
		sum.ChallengeCount = challenges[k]
		sum.SubmissionCount = submissions[k]
		sum.Status = templates[i].Status
		if j, ok := script[k]; ok {
			sum.ScriptQuestions, sum.ScriptWritten = scripts[j].Questions, scripts[j].Written
		}
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
