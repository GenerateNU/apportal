package selection

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type selectionService struct {
	selectionDB *SelectionDB
}

func (s *selectionService) upsert(ctx context.Context, in *UpsertSelectionInput) (*SelectionOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	sel, err := s.selectionDB.UpsertSelection(ctx, in.ID, utils.CurrentActor(ctx).NUID, in.Body.Note)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &SelectionOutput{Body: sel}, nil
}

func (s *selectionService) delete(ctx context.Context, in *utils.ApplicationScopedInput) (*struct{}, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.selectionDB.DeleteSelection(ctx, in.ID, utils.CurrentActor(ctx).NUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *selectionService) list(ctx context.Context, in *ListSelectionsInput) (*SelectionsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := s.selectionDB.ListSelections(ctx, in.ID, in.LeadNUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &SelectionsOutput{Body: items}, nil
}
