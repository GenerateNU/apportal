package reviewranking

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
)

// ShortlistRules decides when an opening's shortlist may be set and where it goes.
type ShortlistRules interface {
	ReviewsIn(ctx context.Context, cycleID, roleID string) (bool, error)
	Advance(ctx context.Context, cycleID, roleID string, appIDs []string, actor pipeline.Actor) ([]string, error)
}

var ErrNoNextStage = errors.New("no enabled stage after review")

type pipelineRules struct {
	db *gorm.DB
}

func NewPipelineRules(db *gorm.DB) ShortlistRules {
	return &pipelineRules{db: db}
}

func (r *pipelineRules) ReviewsIn(ctx context.Context, cycleID, roleID string) (bool, error) {
	return pipeline.ReviewsIn(r.db.WithContext(ctx), cycleID, roleID, time.Now())
}

func (r *pipelineRules) Advance(ctx context.Context, cycleID, roleID string, appIDs []string, actor pipeline.Actor) ([]string, error) {
	if len(appIDs) == 0 {
		return []string{}, nil
	}
	return pipeline.Advance(r.db.WithContext(ctx), pipeline.AdvanceInput{
		CycleID:        cycleID,
		Step:           models.StepReviews,
		RoleID:         roleID,
		ApplicationIDs: appIDs,
		Actor:          actor,
	}, time.Now())
}
