package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type tlAssignmentHandler struct {
	store *store.Store
}

func (h *tlAssignmentHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID:   "assign-tl",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/tl-assignments",
		Summary:       "Assign a TL to write-review an application",
		Description:   "Chief only. Chiefs assign 3 TLs per application.",
		Tags:          []string{"TL assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "list-tl-assignments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/tl-assignments",
		Summary:     "List an application's TL assignments",
		Tags:        []string{"TL assignments"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID:   "unassign-tl",
		Method:        http.MethodDelete,
		Path:          "/tl-assignments/{id}",
		Summary:       "Remove a TL assignment",
		Description:   "Chief only.",
		Tags:          []string{"TL assignments"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.delete)
}

type TLAssignmentOutput struct {
	Body models.TLAssignment
}

type TLAssignmentsOutput struct {
	Body []models.TLAssignment
}

type CreateTLAssignmentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		TLNUID string `json:"tl_nuid"`
	}
}

func (h *tlAssignmentHandler) create(ctx context.Context, in *CreateTLAssignmentInput) (*TLAssignmentOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	a, err := h.store.CreateTLAssignment(ctx, in.ID, in.Body.TLNUID, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &TLAssignmentOutput{Body: a}, nil
}

type ApplicationScopedInput struct {
	ID string `path:"id" doc:"Application ID"`
}

func (h *tlAssignmentHandler) list(ctx context.Context, in *ApplicationScopedInput) (*TLAssignmentsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListTLAssignments(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &TLAssignmentsOutput{Body: items}, nil
}

type IDInput struct {
	ID string `path:"id"`
}

func (h *tlAssignmentHandler) delete(ctx context.Context, in *IDInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeleteTLAssignment(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}
