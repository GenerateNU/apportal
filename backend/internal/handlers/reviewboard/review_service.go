package reviewboard

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
)

type staffPool interface {
	ForKind(ctx context.Context, cycleID string, kind models.StepKind) (staffing.KindRules, error)
	RequireAdd(ctx context.Context, cycleID string, roleIDs []string, kind models.StepKind) error
}

type reviewService struct {
	gate  cycleGate
	store reviewStore
	staff staffPool
}

type CycleIDInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

func parseCycleID(id string) error {
	if _, err := uuid.Parse(id); err != nil {
		return huma.Error422UnprocessableEntity("invalid cycle id")
	}
	return nil
}

func (s *reviewService) manage(ctx context.Context, cycleID string) error {
	if err := access.RequireActor(ctx); err != nil {
		return err
	}
	if err := parseCycleID(cycleID); err != nil {
		return err
	}
	return s.gate.CanCycle(ctx, access.ManageCycle, cycleID)
}
