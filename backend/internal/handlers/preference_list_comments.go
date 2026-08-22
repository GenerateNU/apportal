package handlers

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type PreferenceListCommentOutput struct {
	Body models.PreferenceListCommentDetail
}

type CreatePreferenceListCommentInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		// Omit for a comment on the group as a whole; set to comment on one
		// applicant already in the shared list's cycle.
		ApplicationID *string `json:"application_id,omitempty" doc:"Application ID"`
		Body          string  `json:"body" minLength:"1"`
	}
}

func (h *preferenceListHandler) createComment(ctx context.Context, in *CreatePreferenceListCommentInput) (*PreferenceListCommentOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.ApplicationID != nil {
		list, err := h.store.GetPreferenceList(ctx, in.ID)
		if err != nil {
			return nil, storeErr(err)
		}
		app, err := h.store.GetApplication(ctx, *in.Body.ApplicationID)
		if err != nil {
			return nil, storeErr(err)
		}
		if app.CycleID != list.CycleID {
			return nil, huma.Error422UnprocessableEntity("application is not in this list's cycle")
		}
	}
	comment, err := h.store.CreatePreferenceListComment(ctx, in.ID, in.Body.ApplicationID, currentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListCommentOutput{Body: comment}, nil
}

type UpdatePreferenceListCommentInput struct {
	ID        string `path:"id" doc:"Preference list ID"`
	CommentID string `path:"commentId" doc:"Comment ID"`
	Body      struct {
		Body string `json:"body" minLength:"1"`
	}
}

func (h *preferenceListHandler) updateComment(ctx context.Context, in *UpdatePreferenceListCommentInput) (*PreferenceListCommentOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	comment, err := h.store.UpdatePreferenceListComment(ctx, in.CommentID, currentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListCommentOutput{Body: comment}, nil
}
