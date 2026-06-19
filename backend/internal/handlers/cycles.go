package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type cycleHandler struct {
	store *store.Store
}

func (h *cycleHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-cycles",
		Method:      http.MethodGet,
		Path:        "/cycles",
		Summary:     "List cycles",
		Tags:        []string{"Cycles"},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "get-cycle",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}",
		Summary:     "Get a cycle",
		Tags:        []string{"Cycles"},
		Errors:      []int{http.StatusNotFound},
	}, h.get)

	huma.Register(api, huma.Operation{
		OperationID:   "create-cycle",
		Method:        http.MethodPost,
		Path:          "/cycles",
		Summary:       "Create a cycle",
		Description:   "Chief only.",
		Tags:          []string{"Cycles"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-cycle",
		Method:      http.MethodPatch,
		Path:        "/cycles/{id}",
		Summary:     "Update a cycle",
		Description: "Chief only.",
		Tags:        []string{"Cycles"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.update)
}

// CycleOutput wraps a single cycle response body.
type CycleOutput struct {
	Body models.Cycle
}

// CyclesOutput wraps a list of cycles.
type CyclesOutput struct {
	Body []models.Cycle
}

type CreateCycleInput struct {
	Body struct {
		Name     string             `json:"name"`
		Status   models.CycleStatus `json:"status,omitempty"`
		OpensAt  *time.Time         `json:"opens_at,omitempty"`
		ClosesAt *time.Time         `json:"closes_at,omitempty"`
	}
}

func (h *cycleHandler) create(ctx context.Context, in *CreateCycleInput) (*CycleOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	status := in.Body.Status
	if status == "" {
		status = models.CycleDraft
	}
	if !status.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid status")
	}

	cycle, err := h.store.CreateCycle(ctx, store.CycleCreate{
		Name:     in.Body.Name,
		Status:   status,
		OpensAt:  in.Body.OpensAt,
		ClosesAt: in.Body.ClosesAt,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &CycleOutput{Body: cycle}, nil
}

func (h *cycleHandler) list(ctx context.Context, _ *struct{}) (*CyclesOutput, error) {
	cycles, err := h.store.ListCycles(ctx)
	if err != nil {
		return nil, storeErr(err)
	}
	return &CyclesOutput{Body: cycles}, nil
}

type CycleIDInput struct {
	ID string `path:"id"`
}

func (h *cycleHandler) get(ctx context.Context, in *CycleIDInput) (*CycleOutput, error) {
	cycle, err := h.store.GetCycle(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &CycleOutput{Body: cycle}, nil
}

type UpdateCycleInput struct {
	ID   string `path:"id"`
	Body struct {
		Name     *string             `json:"name,omitempty"`
		Status   *models.CycleStatus `json:"status,omitempty"`
		OpensAt  *time.Time          `json:"opens_at,omitempty"`
		ClosesAt *time.Time          `json:"closes_at,omitempty"`
	}
}

func (h *cycleHandler) update(ctx context.Context, in *UpdateCycleInput) (*CycleOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid status")
	}

	cycle, err := h.store.UpdateCycle(ctx, in.ID, store.CycleUpdate{
		Name:     in.Body.Name,
		Status:   in.Body.Status,
		OpensAt:  in.Body.OpensAt,
		ClosesAt: in.Body.ClosesAt,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &CycleOutput{Body: cycle}, nil
}
