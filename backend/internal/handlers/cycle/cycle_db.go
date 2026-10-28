package cycle

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type CycleDB struct {
	db *gorm.DB
}

func NewCycleDB(db *gorm.DB) *CycleDB {
	return &CycleDB{db: db}
}

type CycleCreate struct {
	Name            string
	Status          models.CycleStatus
	ApplicationType models.ApplicationType
	OpensAt         *time.Time
	ClosesAt        *time.Time
}

// CycleUpdate carries partial-update fields; nil pointers are left unchanged.
type CycleUpdate struct {
	Name            *string
	Status          *models.CycleStatus
	ApplicationType *models.ApplicationType
	OpensAt         *time.Time
	ClosesAt        *time.Time
}

// CycleFilter holds optional list filters; empty fields are ignored.
type CycleFilter struct {
	Status models.CycleStatus
}

type CycleStageCreate struct {
	CycleID             string
	Stage               models.ApplicationStage
	DisplayOrder        int
	IsActive            bool
	RequiredAssignments int
	Label               *string
}

// CycleStageUpdate carries partial-update fields; nil pointers are left unchanged.
type CycleStageUpdate struct {
	DisplayOrder        *int
	IsActive            *bool
	RequiredAssignments *int
	Label               *string
}

func (c *CycleDB) CreateCycle(ctx context.Context, in CycleCreate) (models.Cycle, error) {
	cycle := models.Cycle{
		Name:            in.Name,
		Status:          in.Status,
		ApplicationType: in.ApplicationType,
		OpensAt:         in.OpensAt,
		ClosesAt:        in.ClosesAt,
	}
	err := utils.Insert(c.db.WithContext(ctx), &cycle, "name", "status", "application_type", "opens_at", "closes_at")
	return cycle, err
}

func (c *CycleDB) ListCycles(ctx context.Context, f CycleFilter) ([]models.Cycle, error) {
	q := c.db.WithContext(ctx).Order("created_at DESC")
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	cycles := []models.Cycle{}
	return cycles, q.Find(&cycles).Error
}

func (c *CycleDB) GetCycle(ctx context.Context, id string) (models.Cycle, error) {
	var cycle models.Cycle
	err := c.db.WithContext(ctx).Where("id = ?", id).Take(&cycle).Error
	return cycle, utils.DBErr(err)
}

// CycleRoleSummary counts a role's questions (including global ones),
// challenges, and submitted applications within a cycle.
func (c *CycleDB) CycleRoleSummary(ctx context.Context, cycleID string, role models.Role) (models.CycleRoleSummary, error) {
	db := c.db.WithContext(ctx)
	var questions, challenges, submissions int64
	err := db.Model(&models.Question{}).
		Where("cycle_id = ? AND (application_role = ? OR application_role IS NULL)", cycleID, role).
		Count(&questions).Error
	if err == nil {
		err = db.Model(&models.CodeChallenge{}).
			Where("cycle_id = ? AND application_role = ?", cycleID, role).
			Count(&challenges).Error
	}
	if err == nil {
		err = db.Model(&models.Application{}).
			Where("cycle_id = ? AND application_role = ? AND stage != ?", cycleID, role, models.StageDraft).
			Count(&submissions).Error
	}
	return models.CycleRoleSummary{
		Role:            role,
		QuestionCount:   int(questions),
		ChallengeCount:  int(challenges),
		SubmissionCount: int(submissions),
	}, err
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

// CreateCycleStage adds a stage to a cycle's flow; (cycle_id, stage) is
// unique, so a duplicate is a conflict.
func (c *CycleDB) CreateCycleStage(ctx context.Context, in CycleStageCreate) (models.CycleStage, error) {
	stage := models.CycleStage{
		CycleID:             in.CycleID,
		Stage:               in.Stage,
		DisplayOrder:        in.DisplayOrder,
		IsActive:            in.IsActive,
		RequiredAssignments: in.RequiredAssignments,
		Label:               in.Label,
	}
	err := utils.Insert(c.db.WithContext(ctx), &stage,
		"cycle_id", "stage", "display_order", "is_active", "required_assignments", "label")
	return stage, err
}

func (c *CycleDB) ListCycleStages(ctx context.Context, cycleID string) ([]models.CycleStage, error) {
	stages := []models.CycleStage{}
	err := c.db.WithContext(ctx).Where("cycle_id = ?", cycleID).Order("display_order").Find(&stages).Error
	return stages, err
}

func (c *CycleDB) UpdateCycleStage(ctx context.Context, id string, in CycleStageUpdate) (models.CycleStage, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "display_order", in.DisplayOrder)
	utils.SetIf(updates, "is_active", in.IsActive)
	utils.SetIf(updates, "required_assignments", in.RequiredAssignments)
	utils.SetIf(updates, "label", in.Label)
	return utils.UpdateReturning[models.CycleStage](c.db.WithContext(ctx), updates, "id = ?", id)
}
