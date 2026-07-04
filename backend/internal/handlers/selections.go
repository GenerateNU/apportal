package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type selectionHandler struct {
	store *store.Store
}

func (h *selectionHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "select-application",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/selection",
		Summary:     "Mark an application as wanted for your team",
		Description: "Reviewer only; upserts the calling lead's selection of this application.",
		Tags:        []string{"Selections"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID:   "deselect-application",
		Method:        http.MethodDelete,
		Path:          "/applications/{id}/selection",
		Summary:       "Remove your selection of an application",
		Tags:          []string{"Selections"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusNotFound},
	}, h.delete)

	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-selections",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/selections",
		Summary:     "List a cycle's lead selections",
		Description: "Optional ?lead_nuid= filters to one lead.",
		Tags:        []string{"Selections"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)
}

type SelectionOutput struct {
	Body models.LeadSelection
}

type SelectionsOutput struct {
	Body []models.LeadSelection
}

type UpsertSelectionInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Note *string `json:"note,omitempty"`
	}
}

func (h *selectionHandler) upsert(ctx context.Context, in *UpsertSelectionInput) (*SelectionOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	sel, err := h.store.UpsertSelection(ctx, in.ID, currentActor(ctx).NUID, in.Body.Note)
	if err != nil {
		return nil, storeErr(err)
	}
	return &SelectionOutput{Body: sel}, nil
}

func (h *selectionHandler) delete(ctx context.Context, in *ApplicationScopedInput) (*struct{}, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeleteSelection(ctx, in.ID, currentActor(ctx).NUID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

type ListSelectionsInput struct {
	ID       string `path:"id" doc:"Cycle ID"`
	LeadNUID string `query:"lead_nuid" doc:"Optional lead filter"`
}

func (h *selectionHandler) list(ctx context.Context, in *ListSelectionsInput) (*SelectionsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListSelections(ctx, in.ID, in.LeadNUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &SelectionsOutput{Body: items}, nil
}
