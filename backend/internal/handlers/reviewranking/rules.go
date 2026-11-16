package reviewranking

import (
	"context"
	"errors"
	"math"
	"slices"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// ShortlistRules decides when an opening's shortlist may be set and where it goes.
type ShortlistRules interface {
	ReviewsIn(ctx context.Context, cycleID, roleID string) (bool, error)
	Advance(ctx context.Context, cycleID, roleID string, appIDs []string, actor string) ([]string, error)
}

var ErrNoNextStage = errors.New("no enabled stage after review")

var reviewStages = []models.ApplicationStage{models.StageSubmitted, models.StageLeadReview, models.StageChiefReview}

var settledStages = []models.ApplicationStage{models.StageDraft, models.StageWithdrawn, models.StageRejected}

var notTargets = slices.Concat(reviewStages, settledStages, []models.ApplicationStage{models.StageAccepted})

type stageRules struct {
	db *gorm.DB
}

func NewStageRules(db *gorm.DB) ShortlistRules {
	return &stageRules{db: db}
}

func (r *stageRules) ReviewsIn(ctx context.Context, cycleID, roleID string) (bool, error) {
	var in bool
	err := reviewsInQuery(r.db.WithContext(ctx), cycleID, roleID).Scan(&in).Error
	return in, err
}

func reviewsInQuery(db *gorm.DB, cycleID, roleID string) *gorm.DB {
	assigned := func() *gorm.DB {
		return db.Table("lead_assignments la").Select("1").
			Joins("JOIN applications a ON a.id = la.application_id").
			Where("a.cycle_id = ? AND a.role_id = ? AND a.stage NOT IN ?", cycleID, roleID, settledStages)
	}
	pending := assigned().
		Joins("LEFT JOIN written_reviews wr ON wr.application_id = la.application_id AND wr.reviewer_nuid = la.lead_nuid").
		Where("wr.submitted_at IS NULL")
	closed := db.Table("application_templates").
		Select("review_closes_at <= now()").
		Where("cycle_id = ? AND role_id = ?", cycleID, roleID)
	return db.Raw("SELECT COALESCE((?), false) OR (EXISTS (?) AND NOT EXISTS (?))", closed, assigned(), pending)
}

func (r *stageRules) Advance(ctx context.Context, cycleID, roleID string, appIDs []string, _ string) ([]string, error) {
	moved := []string{}
	if len(appIDs) == 0 {
		return moved, nil
	}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var stages []models.CycleStage
		if err := tx.Where("cycle_id = ?", cycleID).Order("display_order").Find(&stages).Error; err != nil {
			return err
		}
		target, ok := nextStage(stages)
		if !ok {
			return ErrNoNextStage
		}
		return advanceQuery(tx, cycleID, roleID, appIDs, target).Scan(&moved).Error
	})
	return moved, err
}

func advanceQuery(db *gorm.DB, cycleID, roleID string, appIDs []string, target models.ApplicationStage) *gorm.DB {
	return db.Raw(`UPDATE applications SET stage = ? WHERE id IN ? AND cycle_id = ? AND role_id = ? AND stage IN ? RETURNING id`,
		target, appIDs, cycleID, roleID, reviewStages)
}

// nextStage is interview, or the first enabled step after review when a cycle
// has turned interviews off. A cycle with no stages configured uses the default pipeline.
func nextStage(stages []models.CycleStage) (models.ApplicationStage, bool) {
	if len(stages) == 0 {
		return models.StageInterview, true
	}
	after := math.MinInt
	for _, s := range stages {
		if s.Stage == models.StageInterview && s.IsActive {
			return models.StageInterview, true
		}
		if slices.Contains(reviewStages, s.Stage) {
			after = max(after, s.DisplayOrder)
		}
	}
	for _, s := range stages {
		if s.IsActive && s.DisplayOrder > after && !slices.Contains(notTargets, s.Stage) {
			return s.Stage, true
		}
	}
	return "", false
}
