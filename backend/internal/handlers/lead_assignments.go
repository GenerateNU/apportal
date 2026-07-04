package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type leadAssignmentHandler struct {
	store *store.Store
}

func (h *leadAssignmentHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID:   "assign-lead",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/lead-assignments",
		Summary:       "Assign a lead to write-review an application",
		Description:   "Chief only. Chiefs assign 3 leads per application.",
		Tags:          []string{"Lead assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "list-lead-assignments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/lead-assignments",
		Summary:     "List an application's lead assignments",
		Tags:        []string{"Lead assignments"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID:   "unassign-lead",
		Method:        http.MethodDelete,
		Path:          "/lead-assignments/{id}",
		Summary:       "Remove a lead assignment",
		Description:   "Chief only.",
		Tags:          []string{"Lead assignments"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.delete)
}

type LeadAssignmentOutput struct {
	Body models.LeadAssignment
}

type LeadAssignmentsOutput struct {
	Body []models.LeadAssignment
}

type CreateLeadAssignmentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		LeadNUID string `json:"lead_nuid"`
	}
}

func (h *leadAssignmentHandler) create(ctx context.Context, in *CreateLeadAssignmentInput) (*LeadAssignmentOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.LeadNUID == "" {
		return nil, huma.Error422UnprocessableEntity("lead_nuid is required")
	}
	a, err := h.store.CreateLeadAssignment(ctx, in.ID, in.Body.LeadNUID, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &LeadAssignmentOutput{Body: a}, nil
}

// ApplicationScopedInput identifies an operation acting on an application by ID.
// Shared across the pipeline handlers.
type ApplicationScopedInput struct {
	ID string `path:"id" doc:"Application ID"`
}

func (h *leadAssignmentHandler) list(ctx context.Context, in *ApplicationScopedInput) (*LeadAssignmentsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListLeadAssignments(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &LeadAssignmentsOutput{Body: items}, nil
}

// IDInput identifies a resource by its own ID (not application-scoped).
type IDInput struct {
	ID string `path:"id"`
}

func (h *leadAssignmentHandler) delete(ctx context.Context, in *IDInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeleteLeadAssignment(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}
