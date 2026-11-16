package user

import (
	"context"
	"strings"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type userService struct {
	access *access.Checker
	userDB *UserDB
}

func (s *userService) create(ctx context.Context, in *CreateUserInput) (*UserOutput, error) {
	if err := access.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	for _, role := range in.Body.Roles {
		if !role.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
	}
	if err := utils.RequireNortheasternEmail(in.Body.Email); err != nil {
		return nil, err
	}

	user, err := s.userDB.CreateUser(ctx, UserCreate{
		NUID:           in.Body.NUID,
		Email:          strings.ToLower(in.Body.Email),
		FullName:       in.Body.FullName,
		Roles:          in.Body.Roles,
		GraduationYear: in.Body.GraduationYear,
		Major:          in.Body.Major,
		GithubUsername: in.Body.GithubUsername,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &UserOutput{Body: user}, nil
}

// Admins, and anyone staffed on a cycle they can see (to put names to NUIDs).
func (s *userService) list(ctx context.Context, in *ListUsersInput) (*UsersOutput, error) {
	if access.RequireAdmin(ctx) != nil {
		if err := s.access.RequireAnyCycle(ctx, access.Review); err != nil {
			return nil, err
		}
	}
	filter, err := parseUserFilter(in.Role)
	if err != nil {
		return nil, err
	}

	var limit *int
	if in.Limit > 0 {
		limit = &in.Limit
	}

	users, hasMore, err := s.userDB.ListUsers(ctx, filter, limit, in.Offset)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &UsersOutput{}
	out.Body.Users = users
	out.Body.HasMore = hasMore
	return out, nil
}

func (s *userService) get(ctx context.Context, in *UserNUIDInput) (*UserOutput, error) {
	if err := access.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	user, err := s.userDB.GetUser(ctx, in.NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &UserOutput{Body: user}, nil
}

func (s *userService) me(ctx context.Context, _ *MeInput) (*UserOutput, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}
	user, err := s.userDB.GetUser(ctx, actor.NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &UserOutput{Body: user}, nil
}

// parseUserFilter reads list-users' ?role=: a global role, or a staff role
// meaning "on some cycle's staff with that role".
func parseUserFilter(role string) (userFilter, error) {
	if role == "" {
		return userFilter{}, nil
	}
	if r := models.UserRole(role); r.Valid() {
		return userFilter{UserRole: &r}, nil
	}
	if r := models.CycleStaffRole(role); r.Valid() {
		return userFilter{StaffRole: &r}, nil
	}
	return userFilter{}, huma.Error422UnprocessableEntity("invalid role")
}

func (s *userService) update(ctx context.Context, in *UpdateUserInput) (*UserOutput, error) {
	if err := access.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	for _, role := range in.Body.Roles {
		if !role.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
	}

	normalizedEmail := in.Body.Email
	if normalizedEmail != nil {
		if err := utils.RequireNortheasternEmail(*normalizedEmail); err != nil {
			return nil, err
		}
		lowercasedEmail := strings.ToLower(*normalizedEmail)
		normalizedEmail = &lowercasedEmail
	}

	user, err := s.userDB.UpdateUser(ctx, in.NUID, UserUpdate{
		Email:          normalizedEmail,
		FullName:       in.Body.FullName,
		Roles:          in.Body.Roles,
		GraduationYear: in.Body.GraduationYear,
		Major:          in.Body.Major,
		GithubUsername: in.Body.GithubUsername,
		Returner:       in.Body.Returner,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &UserOutput{Body: user}, nil
}
