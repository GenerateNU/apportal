package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type applicationTemplateHandler struct {
	store *store.Store
}

func (h *applicationTemplateHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-application-template",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/template",
		Summary:     "Get a cycle's per-role application template",
		Description: "?role= selects which role's template to fetch (required). Creates a default-titled row on first access.",
		Tags:        []string{"Application Templates"},
		Errors:      []int{http.StatusUnprocessableEntity},
	}, h.get)

	huma.Register(api, huma.Operation{
		OperationID: "update-application-template",
		Method:      http.MethodPatch,
		Path:        "/cycles/{id}/template",
		Summary:     "Update a cycle's per-role application template",
		Description: "Chief only. ?role= selects which role's template to update (required).",
		Tags:        []string{"Application Templates"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity, http.StatusNotFound},
	}, h.update)
}

// ApplicationTemplateOutput wraps a single application template response body.
type ApplicationTemplateOutput struct {
	Body models.ApplicationTemplate
}

func parseTemplateRole(raw string) (models.Role, error) {
	role := models.Role(raw)
	if raw == "" || !role.Valid() {
		return "", huma.Error422UnprocessableEntity("missing or invalid role")
	}
	return role, nil
}

type GetApplicationTemplateInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
}

func (h *applicationTemplateHandler) get(ctx context.Context, in *GetApplicationTemplateInput) (*ApplicationTemplateOutput, error) {
	role, err := parseTemplateRole(in.Role)
	if err != nil {
		return nil, err
	}
	t, err := h.store.GetOrCreateApplicationTemplate(ctx, in.ID, role)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ApplicationTemplateOutput{Body: t}, nil
}

type UpdateApplicationTemplateInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
	Body struct {
		Title        *string             `json:"title,omitempty"`
		Description  *string             `json:"description,omitempty"`
		Instructions *string             `json:"instructions,omitempty"`
		OpensAt      *time.Time          `json:"opens_at,omitempty"`
		ClosesAt     *time.Time          `json:"closes_at,omitempty"`
		Status       *models.CycleStatus `json:"status,omitempty"`
	}
}

func (h *applicationTemplateHandler) update(ctx context.Context, in *UpdateApplicationTemplateInput) (*ApplicationTemplateOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	role, err := parseTemplateRole(in.Role)
	if err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid status")
	}

	t, err := h.store.UpdateApplicationTemplate(ctx, in.ID, role, store.ApplicationTemplateUpdate{
		Title:        in.Body.Title,
		Description:  in.Body.Description,
		Instructions: in.Body.Instructions,
		OpensAt:      in.Body.OpensAt,
		ClosesAt:     in.Body.ClosesAt,
		Status:       in.Body.Status,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &ApplicationTemplateOutput{Body: t}, nil
}
