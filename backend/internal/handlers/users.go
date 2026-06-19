package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type userHandler struct {
	store *store.Store
}

func (h *userHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-users",
		Method:      http.MethodGet,
		Path:        "/users",
		Summary:     "List reviewers",
		Description: "Chief only.",
		Tags:        []string{"Users"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "get-user",
		Method:      http.MethodGet,
		Path:        "/users/{nuid}",
		Summary:     "Get a reviewer",
		Description: "Chief only.",
		Tags:        []string{"Users"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.get)

	huma.Register(api, huma.Operation{
		OperationID:   "create-user",
		Method:        http.MethodPost,
		Path:          "/users",
		Summary:       "Create a reviewer",
		Description:   "Chief only.",
		Tags:          []string{"Users"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-user",
		Method:      http.MethodPatch,
		Path:        "/users/{nuid}",
		Summary:     "Update a reviewer",
		Description: "Chief only.",
		Tags:        []string{"Users"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict},
	}, h.update)
}

type UserOutput struct {
	Body models.User
}

type UsersOutput struct {
	Body []models.User
}

type CreateUserInput struct {
	Body struct {
		NUID           string               `json:"nuid"`
		Email          string               `json:"email"`
		FullName       string               `json:"full_name"`
		ReviewerRole   *models.ReviewerRole `json:"reviewer_role,omitempty"`
		GithubUsername *string              `json:"github_username,omitempty"`
	}
}

func (h *userHandler) create(ctx context.Context, in *CreateUserInput) (*UserOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.ReviewerRole != nil && !in.Body.ReviewerRole.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid reviewer_role")
	}

	user, err := h.store.CreateUser(ctx, store.UserCreate{
		NUID:           in.Body.NUID,
		Email:          in.Body.Email,
		FullName:       in.Body.FullName,
		ReviewerRole:   in.Body.ReviewerRole,
		GithubUsername: in.Body.GithubUsername,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &UserOutput{Body: user}, nil
}

type ListUsersInput struct {
	ReviewerRole string `query:"reviewer_role" doc:"Optional reviewer role filter"`
}

func (h *userHandler) list(ctx context.Context, in *ListUsersInput) (*UsersOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	var reviewerRole *models.ReviewerRole
	if in.ReviewerRole != "" {
		parsed := models.ReviewerRole(in.ReviewerRole)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid reviewer_role")
		}
		reviewerRole = &parsed
	}

	users, err := h.store.ListUsers(ctx, reviewerRole)
	if err != nil {
		return nil, storeErr(err)
	}
	return &UsersOutput{Body: users}, nil
}

type UserNUIDInput struct {
	NUID string `path:"nuid"`
}

func (h *userHandler) get(ctx context.Context, in *UserNUIDInput) (*UserOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	user, err := h.store.GetUser(ctx, in.NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &UserOutput{Body: user}, nil
}

type UpdateUserInput struct {
	NUID string `path:"nuid"`
	Body struct {
		Email          *string              `json:"email,omitempty"`
		FullName       *string              `json:"full_name,omitempty"`
		ReviewerRole   *models.ReviewerRole `json:"reviewer_role,omitempty"`
		GithubUsername *string              `json:"github_username,omitempty"`
	}
}

func (h *userHandler) update(ctx context.Context, in *UpdateUserInput) (*UserOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.ReviewerRole != nil && !in.Body.ReviewerRole.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid reviewer_role")
	}

	user, err := h.store.UpdateUser(ctx, in.NUID, store.UserUpdate{
		Email:          in.Body.Email,
		FullName:       in.Body.FullName,
		ReviewerRole:   in.Body.ReviewerRole,
		GithubUsername: in.Body.GithubUsername,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &UserOutput{Body: user}, nil
}
