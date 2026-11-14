package cycle

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type cycleStageService struct {
	access  *access.Checker
	cycleDB *CycleDB
}

func (s *cycleStageService) create(ctx context.Context, in *CreateCycleStageInput) (*CycleStageOutput, error) {
	if err := access.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Stage.Valid() {
		return nil, huma.Error422UnprocessableEntity("valid stage is required")
	}
	active := true
	if in.Body.IsActive != nil {
		active = *in.Body.IsActive
	}

	stage, err := s.cycleDB.CreateCycleStage(ctx, CycleStageCreate{
		CycleID:             in.ID,
		Stage:               in.Body.Stage,
		DisplayOrder:        in.Body.DisplayOrder,
		IsActive:            active,
		RequiredAssignments: in.Body.RequiredAssignments,
		Label:               in.Body.Label,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CycleStageOutput{Body: stage}, nil
}

func (s *cycleStageService) list(ctx context.Context, in *ListCycleStagesInput) (*CycleStagesOutput, error) {
	if err := s.access.RequireCycle(ctx, in.ID, access.Review); err != nil {
		return nil, err
	}
	stages, err := s.cycleDB.ListCycleStages(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CycleStagesOutput{Body: stages}, nil
}

func (s *cycleStageService) update(ctx context.Context, in *UpdateCycleStageInput) (*CycleStageOutput, error) {
	if err := access.RequireAdmin(ctx); err != nil {
		return nil, err
	}

	stage, err := s.cycleDB.UpdateCycleStage(ctx, in.ID, CycleStageUpdate{
		DisplayOrder:        in.Body.DisplayOrder,
		IsActive:            in.Body.IsActive,
		RequiredAssignments: in.Body.RequiredAssignments,
		Label:               in.Body.Label,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CycleStageOutput{Body: stage}, nil
}
