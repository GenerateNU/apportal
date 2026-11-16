package cycle

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type cycleService struct {
	access  *access.Checker
	cycleDB *CycleDB
	roleDB  *role.RoleDB
}

func (s *cycleService) create(ctx context.Context, in *CreateCycleInput) (*CycleOutput, error) {
	if err := access.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	if in.Body.BranchID == "" {
		return nil, huma.Error422UnprocessableEntity("branch_id is required")
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
		Status:          models.CycleDraft,
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
	filter := CycleFilter{BranchID: in.BranchID, Listable: s.access.ListableCycles(ctx)}
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
	if err := s.access.CanCycle(ctx, access.ReviewCycle, in.ID); err != nil {
		return nil, err
	}
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
	cycle, err := s.cycleDB.GetCycle(ctx, in.ID, CycleFilter{Listable: s.access.ListableCycles(ctx)})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CycleOutput{Body: cycle}, nil
}

func (s *cycleService) update(ctx context.Context, in *UpdateCycleInput) (*CycleOutput, error) {
	if err := access.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	if in.Body.ApplicationType != nil && !in.Body.ApplicationType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid application_type")
	}

	if in.Body.Status != nil {
		current, err := s.cycleDB.GetCycle(ctx, in.ID, CycleFilter{})
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if err := archiveOnly(current.Status, *in.Body.Status); err != nil {
			return nil, err
		}
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

// archiveOnly keeps open and close on the workflow: releasing applications opens a cycle and closing it is a workflow action.
func archiveOnly(from, to models.CycleStatus) error {
	switch {
	case !to.Valid():
		return huma.Error422UnprocessableEntity("invalid status")
	case from == to:
		return nil
	case from == models.CycleClosed && to == models.CycleArchived, from == models.CycleArchived && to == models.CycleClosed:
		return nil
	}
	return huma.Error409Conflict("only a closed cycle can be archived or restored; open and close a cycle from its workflow")
}
