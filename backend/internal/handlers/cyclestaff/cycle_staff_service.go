package cyclestaff

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type cycleStaffService struct {
	staffDB *CycleStaffDB
	access  *access.Checker
}

// Admins see any cycle's staff; a chief sees their own cycle's, to assign work.
func (s *cycleStaffService) list(ctx context.Context, in *CycleIDInput) (*StaffOutput, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}
	if !access.IsAdmin(actor) {
		if err := s.access.RequireCycle(ctx, in.ID, access.Manage); err != nil {
			return nil, err
		}
	}
	rows, err := s.staffDB.ListStaff(ctx, in.ID, "")
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &StaffOutput{Body: rows}, nil
}

func (s *cycleStaffService) set(ctx context.Context, in *SetStaffInput) (*StaffMemberOutput, error) {
	if err := access.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role must be lead or chief")
	}
	row, err := s.staffDB.SetStaff(ctx, in.ID, in.NUID, in.Body.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &StaffMemberOutput{Body: row}, nil
}

func (s *cycleStaffService) remove(ctx context.Context, in *StaffMemberInput) (*struct{}, error) {
	if err := access.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	if err := s.staffDB.RemoveStaff(ctx, in.ID, in.NUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}
