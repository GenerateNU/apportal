package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type cycleStageHandler struct {
	store *store.Store
}

func (h *cycleStageHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-stages",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/stages",
		Summary:     "List a cycle's flow-template stages",
		Tags:        []string{"Cycle stages"},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-cycle-stage",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/stages",
		Summary:       "Add a stage to a cycle's flow template",
		Description:   "Chief only.",
		Tags:          []string{"Cycle stages"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-cycle-stage",
		Method:      http.MethodPatch,
		Path:        "/cycle-stages/{id}",
		Summary:     "Update a cycle stage",
		Description: "Chief only.",
		Tags:        []string{"Cycle stages"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.update)
}

type CycleStageOutput struct {
	Body models.CycleStage
}

type CycleStagesOutput struct {
	Body []models.CycleStage
}

type CreateCycleStageInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Stage               models.ApplicationStage `json:"stage"`
		DisplayOrder        int                     `json:"display_order"`
		IsActive            *bool                   `json:"is_active,omitempty"`
		RequiredAssignments int                     `json:"required_assignments,omitempty"`
		Label               *string                 `json:"label,omitempty"`
	}
}

func (h *cycleStageHandler) create(ctx context.Context, in *CreateCycleStageInput) (*CycleStageOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Stage.Valid() {
		return nil, huma.Error422UnprocessableEntity("valid stage is required")
	}
	active := true
	if in.Body.IsActive != nil {
		active = *in.Body.IsActive
	}

	stage, err := h.store.CreateCycleStage(ctx, store.CycleStageCreate{
		CycleID:             in.ID,
		Stage:               in.Body.Stage,
		DisplayOrder:        in.Body.DisplayOrder,
		IsActive:            active,
		RequiredAssignments: in.Body.RequiredAssignments,
		Label:               in.Body.Label,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &CycleStageOutput{Body: stage}, nil
}

type ListCycleStagesInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

func (h *cycleStageHandler) list(ctx context.Context, in *ListCycleStagesInput) (*CycleStagesOutput, error) {
	stages, err := h.store.ListCycleStages(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &CycleStagesOutput{Body: stages}, nil
}

type UpdateCycleStageInput struct {
	ID   string `path:"id" doc:"Cycle stage ID"`
	Body struct {
		DisplayOrder        *int    `json:"display_order,omitempty"`
		IsActive            *bool   `json:"is_active,omitempty"`
		RequiredAssignments *int    `json:"required_assignments,omitempty"`
		Label               *string `json:"label,omitempty"`
	}
}

func (h *cycleStageHandler) update(ctx context.Context, in *UpdateCycleStageInput) (*CycleStageOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}

	stage, err := h.store.UpdateCycleStage(ctx, in.ID, store.CycleStageUpdate{
		DisplayOrder:        in.Body.DisplayOrder,
		IsActive:            in.Body.IsActive,
		RequiredAssignments: in.Body.RequiredAssignments,
		Label:               in.Body.Label,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &CycleStageOutput{Body: stage}, nil
}
