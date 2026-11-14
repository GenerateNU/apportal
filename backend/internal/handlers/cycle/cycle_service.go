package cycle

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type cycleService struct {
	cycleDB *CycleDB
	roleDB  *role.RoleDB
}

func (s *cycleService) create(ctx context.Context, in *CreateCycleInput) (*CycleOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.BranchID == "" {
		return nil, huma.Error422UnprocessableEntity("branch_id is required")
	}
	status := in.Body.Status
	if status == "" {
		status = models.CycleDraft
	}
	if !status.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid status")
	}
	appType := in.Body.ApplicationType
	if appType == "" {
		appType = models.ApplicationTypeMember
	}
	if !appType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid application_type")
	}

	cycle, err := s.cycleDB.CreateCycle(ctx, CycleCreate{
		BranchID:        in.Body.BranchID,
		Name:            in.Body.Name,
		Status:          status,
		ApplicationType: appType,
		OpensAt:         in.Body.OpensAt,
		ClosesAt:        in.Body.ClosesAt,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CycleOutput{Body: cycle}, nil
}

func (s *cycleService) list(ctx context.Context, in *ListCyclesInput) (*CyclesOutput, error) {
	filter := CycleFilter{BranchID: in.BranchID}
	if in.Status != "" {
		parsed := models.CycleStatus(in.Status)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid status")
		}
		filter.Status = parsed
	}

	cycles, err := s.cycleDB.ListCycles(ctx, filter)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CyclesOutput{Body: cycles}, nil
}

func (s *cycleService) templateSummary(ctx context.Context, in *CycleIDInput) (*CycleTemplateSummaryOutput, error) {
	roles, err := s.roleDB.ListCycleRoles(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	summaries := make([]models.CycleRoleSummary, 0, len(roles))
	for _, r := range roles {
		summary, err := s.cycleDB.CycleRoleSummary(ctx, in.ID, r.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		summaries = append(summaries, summary)
	}
	return &CycleTemplateSummaryOutput{Body: summaries}, nil
}

func (s *cycleService) get(ctx context.Context, in *CycleIDInput) (*CycleOutput, error) {
	cycle, err := s.cycleDB.GetCycle(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CycleOutput{Body: cycle}, nil
}

func (s *cycleService) update(ctx context.Context, in *UpdateCycleInput) (*CycleOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid status")
	}
	if in.Body.ApplicationType != nil && !in.Body.ApplicationType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid application_type")
	}

	cycle, err := s.cycleDB.UpdateCycle(ctx, in.ID, CycleUpdate{
		Name:            in.Body.Name,
		Status:          in.Body.Status,
		ApplicationType: in.Body.ApplicationType,
		OpensAt:         in.Body.OpensAt,
		ClosesAt:        in.Body.ClosesAt,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CycleOutput{Body: cycle}, nil
}
