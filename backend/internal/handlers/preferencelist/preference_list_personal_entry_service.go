package preferencelist

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

func (s *preferenceListService) upsertPersonalEntry(ctx context.Context, in *UpsertPreferenceListPersonalEntryInput) (*PreferenceListPersonalEntryOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	app, err := s.applicationDB.GetApplication(ctx, in.ApplicationID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if app.CycleID != list.CycleID {
		return nil, huma.Error422UnprocessableEntity("application is not in this list's cycle")
	}
	entry, err := s.preferenceListDB.UpsertPersonalPreferenceListEntry(ctx, PreferenceListPersonalEntryUpsert{
		PreferenceListID: in.ID,
		OwnerNUID:        utils.CurrentActor(ctx).NUID,
		ApplicationID:    in.ApplicationID,
		Role:             app.Role,
		Reasoning:        in.Body.Reasoning,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListPersonalEntryOutput{Body: entry}, nil
}

func (s *preferenceListService) deletePersonalEntry(ctx context.Context, in *PreferenceListEntryScopedInput) (*struct{}, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := s.preferenceListDB.DeletePersonalPreferenceListEntry(ctx, in.ID, utils.CurrentActor(ctx).NUID, in.ApplicationID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *preferenceListService) reorderPersonalEntries(ctx context.Context, in *ReorderPreferenceListPersonalEntriesInput) (*PreferenceListPersonalEntriesDetailOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if len(in.Body.ApplicationIDs) == 0 {
		return nil, huma.Error422UnprocessableEntity("application_ids is required")
	}
	actor := utils.CurrentActor(ctx)
	roles, err := s.applicationDB.DistinctApplicationRoles(ctx, in.Body.ApplicationIDs, list.CycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if len(roles) != 1 {
		return nil, huma.Error422UnprocessableEntity("application_ids must all share one role within this list's cycle")
	}
	current, err := s.preferenceListDB.ListPersonalPreferenceListEntryApplicationIDs(ctx, in.ID, actor.NUID, roles[0])
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !samePermutation(current, in.Body.ApplicationIDs) {
		return nil, huma.Error422UnprocessableEntity("application_ids must include every current entry exactly once")
	}
	if err := s.preferenceListDB.ReorderPersonalPreferenceListEntries(ctx, in.ID, actor.NUID, in.Body.ApplicationIDs); err != nil {
		return nil, utils.StoreErr(err)
	}
	detail, err := s.preferenceListDB.GetPreferenceListDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	mine := make([]models.PreferenceListPersonalEntryDetail, 0, len(detail.PersonalEntries))
	for _, e := range detail.PersonalEntries {
		if e.OwnerNUID == actor.NUID {
			mine = append(mine, e)
		}
	}
	return &PreferenceListPersonalEntriesDetailOutput{Body: mine}, nil
}
