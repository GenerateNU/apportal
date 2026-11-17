package reviewranking

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

// ShortlistRules decides when an opening's shortlist may be set and where it goes.
type ShortlistRules interface {
	ReviewsIn(ctx context.Context, cycleID, roleID string) (bool, error)
	Editable(ctx context.Context, cycleID, roleID string) error
	Advance(ctx context.Context, cycleID, roleID string, appIDs []string, verify func(tx *gorm.DB) error) ([]string, error)
}

var ErrNoNextStage = errors.New("no enabled stage after review")

type workflowRules struct {
	workflow *workflow.Service
}

func NewWorkflowRules(db *gorm.DB) ShortlistRules {
	return &workflowRules{workflow: workflow.NewService(db)}
}

func (r *workflowRules) ReviewsIn(ctx context.Context, cycleID, roleID string) (bool, error) {
	return r.workflow.ReviewsIn(ctx, cycleID, roleID)
}

func (r *workflowRules) Editable(ctx context.Context, cycleID, roleID string) error {
	return r.workflow.RequireOpeningWorkEditable(ctx, cycleID, roleID, workflow.WorkShortlist)
}

func (r *workflowRules) Advance(ctx context.Context, cycleID, roleID string, appIDs []string, verify func(tx *gorm.DB) error) ([]string, error) {
	if len(appIDs) == 0 {
		return []string{}, nil
	}
	moved, _, err := r.workflow.Advance(ctx, workflow.AdvanceInput{
		CycleID:        cycleID,
		Step:           models.StepReviews,
		RoleID:         roleID,
		ApplicationIDs: appIDs,
		Verify:         verify,
		RejectRest:     true,
	})
	return moved, err
}
