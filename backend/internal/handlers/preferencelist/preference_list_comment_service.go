package preferencelist

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

func (s *preferenceListService) createComment(ctx context.Context, in *CreatePreferenceListCommentInput) (*PreferenceListCommentOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.ApplicationID != nil {
		list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		app, err := s.applicationDB.GetApplication(ctx, *in.Body.ApplicationID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if app.CycleID != list.CycleID {
			return nil, huma.Error422UnprocessableEntity("application is not in this list's cycle")
		}
	}
	comment, err := s.preferenceListDB.CreatePreferenceListComment(ctx, in.ID, in.Body.ApplicationID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListCommentOutput{Body: comment}, nil
}

func (s *preferenceListService) updateComment(ctx context.Context, in *UpdatePreferenceListCommentInput) (*PreferenceListCommentOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	comment, err := s.preferenceListDB.UpdatePreferenceListComment(ctx, in.ID, in.CommentID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListCommentOutput{Body: comment}, nil
}
