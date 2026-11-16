package reviewrules

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const DefaultPerApplicant = 2

// Maps are keyed by role (opening) ID and cover every opening on the cycle.
type Rules interface {
	PerApplicant(ctx context.Context, cycleID string) (int, error)
	Released(ctx context.Context, cycleID string) (map[string]bool, error)
	Eligible(ctx context.Context, cycleID string) (map[string][]string, error)
}

type Default struct {
	db *gorm.DB
}

func NewDefault(db *gorm.DB) *Default {
	return &Default{db: db}
}

func (d *Default) PerApplicant(ctx context.Context, cycleID string) (int, error) {
	var n []int
	err := d.db.WithContext(ctx).Model(&models.CycleStage{}).
		Where("cycle_id = ? AND stage = ?", cycleID, models.StageLeadReview).
		Pluck("required_assignments", &n).Error
	if err != nil {
		return 0, err
	}
	if len(n) == 0 || n[0] <= 0 {
		return DefaultPerApplicant, nil
	}
	return n[0], nil
}

func (d *Default) Released(ctx context.Context, cycleID string) (map[string]bool, error) {
	var ids []string
	err := d.db.WithContext(ctx).Model(&models.ApplicationTemplate{}).
		Where("cycle_id = ? AND review_status IN ?", cycleID, []models.CycleStatus{models.CycleOpen, models.CycleClosed}).
		Pluck("role_id", &ids).Error
	out := make(map[string]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out, err
}

func (d *Default) Eligible(ctx context.Context, cycleID string) (map[string][]string, error) {
	db := d.db.WithContext(ctx)
	var roles, staff []string
	if err := db.Model(&models.Role{}).Where("cycle_id = ?", cycleID).Order("id").Pluck("id", &roles).Error; err != nil {
		return nil, err
	}
	if err := db.Model(&models.CycleStaff{}).Where("cycle_id = ?", cycleID).Order("user_nuid").Pluck("user_nuid", &staff).Error; err != nil {
		return nil, err
	}
	out := make(map[string][]string, len(roles))
	for _, r := range roles {
		out[r] = staff
	}
	return out, nil
}
