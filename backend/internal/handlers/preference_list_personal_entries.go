package handlers

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// Personal-list routes always act on the calling actor's own entries — there
// is no owner in the URL, since "personal" only ever means "mine" for
// writes. Reads (GetPreferenceListDetail's PersonalEntries) return every
// member's personal entries together, since the whole group can see them.

type PreferenceListPersonalEntryOutput struct {
	Body models.PreferenceListPersonalEntry
}

type UpsertPreferenceListPersonalEntryInput struct {
	ID            string `path:"id" doc:"Preference list ID"`
	ApplicationID string `path:"applicationId" doc:"Application ID"`
	Body          struct {
		// nil leaves any existing reasoning untouched; pass "" to clear it.
		Reasoning *string `json:"reasoning,omitempty"`
	}
}

func (h *preferenceListHandler) upsertPersonalEntry(ctx context.Context, in *UpsertPreferenceListPersonalEntryInput) (*PreferenceListPersonalEntryOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := h.store.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	app, err := h.store.GetApplication(ctx, in.ApplicationID)
	if err != nil {
		return nil, storeErr(err)
	}
	if app.CycleID != list.CycleID {
		return nil, huma.Error422UnprocessableEntity("application is not in this list's cycle")
	}
	entry, err := h.store.UpsertPersonalPreferenceListEntry(ctx, store.PreferenceListPersonalEntryUpsert{
		PreferenceListID: in.ID,
		OwnerNUID:        currentActor(ctx).NUID,
		ApplicationID:    in.ApplicationID,
		Role:             app.Role,
		Reasoning:        in.Body.Reasoning,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListPersonalEntryOutput{Body: entry}, nil
}

func (h *preferenceListHandler) deletePersonalEntry(ctx context.Context, in *PreferenceListEntryScopedInput) (*struct{}, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := h.store.DeletePersonalPreferenceListEntry(ctx, in.ID, currentActor(ctx).NUID, in.ApplicationID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

type ReorderPreferenceListPersonalEntriesInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		ApplicationIDs []string `json:"application_ids"`
	}
}

type PreferenceListPersonalEntriesDetailOutput struct {
	Body []models.PreferenceListPersonalEntryDetail
}

func (h *preferenceListHandler) reorderPersonalEntries(ctx context.Context, in *ReorderPreferenceListPersonalEntriesInput) (*PreferenceListPersonalEntriesDetailOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := h.store.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if len(in.Body.ApplicationIDs) == 0 {
		return nil, huma.Error422UnprocessableEntity("application_ids is required")
	}
	actor := currentActor(ctx)
	roles, err := h.store.DistinctApplicationRoles(ctx, in.Body.ApplicationIDs, list.CycleID)
	if err != nil {
		return nil, storeErr(err)
	}
	if len(roles) != 1 {
		return nil, huma.Error422UnprocessableEntity("application_ids must all share one role within this list's cycle")
	}
	current, err := h.store.ListPersonalPreferenceListEntryApplicationIDs(ctx, in.ID, actor.NUID, roles[0])
	if err != nil {
		return nil, storeErr(err)
	}
	if !samePermutation(current, in.Body.ApplicationIDs) {
		return nil, huma.Error422UnprocessableEntity("application_ids must include every current entry exactly once")
	}
	if err := h.store.ReorderPersonalPreferenceListEntries(ctx, in.ID, actor.NUID, in.Body.ApplicationIDs); err != nil {
		return nil, storeErr(err)
	}
	detail, err := h.store.GetPreferenceListDetail(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	mine := make([]models.PreferenceListPersonalEntryDetail, 0, len(detail.PersonalEntries))
	for _, e := range detail.PersonalEntries {
		if e.OwnerNUID == actor.NUID {
			mine = append(mine, e)
		}
	}
	return &PreferenceListPersonalEntriesDetailOutput{Body: mine}, nil
}
