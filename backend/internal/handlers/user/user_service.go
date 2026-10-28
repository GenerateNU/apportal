package user

import (
	"context"
	"strings"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type userService struct {
	userDB *UserDB
}

func (s *userService) create(ctx context.Context, in *CreateUserInput) (*UserOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	for _, role := range in.Body.Roles {
		if !role.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
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

func (s *userService) list(ctx context.Context, in *ListUsersInput) (*UsersOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	var role *models.UserRole
	if in.Role != "" {
		parsed := models.UserRole(in.Role)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
		role = &parsed
	}

	var limit *int
	if in.Limit > 0 {
		limit = &in.Limit
	}

	users, hasMore, err := s.userDB.ListUsers(ctx, role, limit, in.Offset)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &UsersOutput{}
	out.Body.Users = users
	out.Body.HasMore = hasMore
	return out, nil
}

func (s *userService) get(ctx context.Context, in *UserNUIDInput) (*UserOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
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

func (s *userService) update(ctx context.Context, in *UpdateUserInput) (*UserOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	for _, role := range in.Body.Roles {
		if !role.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
	}

	normalizedEmail := in.Body.Email
	if normalizedEmail != nil {
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
