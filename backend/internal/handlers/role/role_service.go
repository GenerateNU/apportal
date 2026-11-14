package role

import (
	"context"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type roleService struct {
	roleDB *RoleDB
}

// RequireCycleRole 422s unless roleID is one of the cycle's roles.
func RequireCycleRole(ctx context.Context, roles *RoleDB, cycleID, roleID string) error {
	if err := ParseRoleID(roleID); err != nil {
		return err
	}
	ok, err := roles.CycleHasRole(ctx, cycleID, roleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	if !ok {
		return huma.Error422UnprocessableEntity("role_id is not a role in this cycle")
	}
	return nil
}

// ParseRoleID 422s on a missing or malformed role ID, before it reaches SQL.
func ParseRoleID(roleID string) error {
	if roleID == "" {
		return huma.Error422UnprocessableEntity("role_id is required")
	}
	if _, err := uuid.Parse(roleID); err != nil {
		return huma.Error422UnprocessableEntity("invalid role_id")
	}
	return nil
}

func (s *roleService) create(ctx context.Context, in *CreateRoleInput) (*RoleOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.CycleID == "" {
		return nil, huma.Error422UnprocessableEntity("cycle_id is required")
	}
	name := strings.TrimSpace(in.Body.Name)
	if name == "" {
		return nil, huma.Error422UnprocessableEntity("name is required")
	}

	role, err := s.roleDB.CreateRole(ctx, in.Body.CycleID, name)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &RoleOutput{Body: role}, nil
}

func (s *roleService) list(ctx context.Context, in *ListRolesInput) (*RolesOutput, error) {
	roles, err := s.roleDB.ListRoles(ctx, in.CycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &RolesOutput{Body: roles}, nil
}

func (s *roleService) get(ctx context.Context, in *RoleIDInput) (*RoleOutput, error) {
	role, err := s.roleDB.GetRole(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &RoleOutput{Body: role}, nil
}

func (s *roleService) update(ctx context.Context, in *UpdateRoleInput) (*RoleOutput, error) {
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

	role, err := s.roleDB.UpdateRole(ctx, in.ID, RoleUpdate{Name: name})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &RoleOutput{Body: role}, nil
}

func (s *roleService) delete(ctx context.Context, in *RoleIDInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.roleDB.DeleteRole(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}
