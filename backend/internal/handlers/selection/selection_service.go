package selection

import (
	"context"
	"slices"

	"github.com/GenerateNU/apportal/backend/internal/utils"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type selectionService struct {
	access      *access.Checker
	selectionDB *SelectionDB
	workflow    *workflow.Service
}

func (s *selectionService) editable(ctx context.Context, applicationID string) error {
	if err := s.access.CanApplication(ctx, access.ReviewApplication, applicationID); err != nil {
		return err
	}
	return s.workflow.RequireWorkEditable(ctx, applicationID, workflow.WorkSelection)
}

func (s *selectionService) upsert(ctx context.Context, in *UpsertSelectionInput) (*SelectionOutput, error) {
	if err := s.editable(ctx, in.ID); err != nil {
		return nil, err
	}
	sel, err := s.selectionDB.UpsertSelection(ctx, in.ID, utils.CurrentActor(ctx).NUID, in.Body.Note)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &SelectionOutput{Body: sel}, nil
}

func (s *selectionService) delete(ctx context.Context, in *utils.ApplicationScopedInput) (*struct{}, error) {
	if err := s.editable(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := s.selectionDB.DeleteSelection(ctx, in.ID, utils.CurrentActor(ctx).NUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *selectionService) list(ctx context.Context, in *ListSelectionsInput) (*SelectionsOutput, error) {
	if err := s.access.CanCycle(ctx, access.ReviewCycle, in.ID); err != nil {
		return nil, err
	}
	items, err := s.selectionDB.ListSelections(ctx, in.ID, in.LeadNUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	ids := make([]string, len(items))
	for i, it := range items {
		ids[i] = it.ApplicationID
	}
	visible, err := s.workflow.VisibleApplications(ctx, ids, workflow.WorkSelection)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	kept := items[:0]
	for _, it := range items {
		if slices.Contains(visible, it.ApplicationID) {
			kept = append(kept, it)
		}
	}
	return &SelectionsOutput{Body: kept}, nil
}
