package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type challengeHandler struct {
	store *store.Store
}

func (h *challengeHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-challenges",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/challenges",
		Summary:     "List a cycle's code challenges",
		Tags:        []string{"Code challenges"},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-challenge",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/challenges",
		Summary:       "Create a code challenge",
		Description:   "Chief only.",
		Tags:          []string{"Code challenges"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.create)
}

type ChallengeOutput struct {
	Body models.CodeChallenge
}

type ChallengesOutput struct {
	Body []models.CodeChallenge
}

type CreateChallengeInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role         models.Role `json:"role"`
		Name         string      `json:"name"`
		ChallengeURL *string     `json:"challenge_url,omitempty"`
		Instructions *string     `json:"instructions,omitempty"`
		DueAt        *time.Time  `json:"due_at,omitempty"`
	}
}

func (h *challengeHandler) create(ctx context.Context, in *CreateChallengeInput) (*ChallengeOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("valid role is required")
	}

	challenge, err := h.store.CreateChallenge(ctx, store.ChallengeCreate{
		CycleID:      in.ID,
		Role:         in.Body.Role,
		Name:         in.Body.Name,
		ChallengeURL: in.Body.ChallengeURL,
		Instructions: in.Body.Instructions,
		DueAt:        in.Body.DueAt,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &ChallengeOutput{Body: challenge}, nil
}

type ListChallengesInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Optional role filter"`
}

func (h *challengeHandler) list(ctx context.Context, in *ListChallengesInput) (*ChallengesOutput, error) {
	var role *models.Role
	if in.Role != "" {
		parsed := models.Role(in.Role)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
		role = &parsed
	}

	challenges, err := h.store.ListChallenges(ctx, in.ID, role)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ChallengesOutput{Body: challenges}, nil
}
