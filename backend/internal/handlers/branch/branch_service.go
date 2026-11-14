package branch

import (
	"context"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type branchService struct {
	branchDB *BranchDB
}

func (s *branchService) create(ctx context.Context, in *CreateBranchInput) (*BranchOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Body.Name)
	if name == "" {
		return nil, huma.Error422UnprocessableEntity("name is required")
	}

	branch, err := s.branchDB.CreateBranch(ctx, name)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &BranchOutput{Body: branch}, nil
}

func (s *branchService) list(ctx context.Context, _ *ListBranchesInput) (*BranchesOutput, error) {
	branches, err := s.branchDB.ListBranches(ctx)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &BranchesOutput{Body: branches}, nil
}

func (s *branchService) get(ctx context.Context, in *BranchIDInput) (*BranchOutput, error) {
	branch, err := s.branchDB.GetBranch(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &BranchOutput{Body: branch}, nil
}

func (s *branchService) update(ctx context.Context, in *UpdateBranchInput) (*BranchOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	var name *string
	if in.Body.Name != nil {
		trimmed := strings.TrimSpace(*in.Body.Name)
		if trimmed == "" {
			return nil, huma.Error422UnprocessableEntity("name cannot be blank")
		}
		name = &trimmed
	}

	branch, err := s.branchDB.UpdateBranch(ctx, in.ID, BranchUpdate{Name: name})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &BranchOutput{Body: branch}, nil
}
