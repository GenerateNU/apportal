package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type interviewCommentHandler struct {
	store *store.Store
}

func (h *interviewCommentHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-interview-comments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview-comments",
		Summary:     "List an application's interview comments",
		Description: "Reviewer only. Open to any reviewer, not just the assigned interviewer/chief.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "create-interview-comment",
		Method:      http.MethodPost,
		Path:        "/applications/{id}/interview-comments",
		Summary:     "Add an interview comment",
		Description: "Reviewer only. Any reviewer may leave any number of comments on an application.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-interview-comment",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/interview-comments/{commentId}",
		Summary:     "Edit an interview comment",
		Description: "Reviewer only, and only the comment's own author.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.update)
}

type InterviewCommentOutput struct {
	Body models.InterviewCommentDetail
}

type InterviewCommentsOutput struct {
	Body []models.InterviewCommentDetail
}

func (h *interviewCommentHandler) list(ctx context.Context, in *ApplicationScopedInput) (*InterviewCommentsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListInterviewComments(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewCommentsOutput{Body: items}, nil
}

type CreateInterviewCommentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Body string `json:"body" minLength:"1"`
	}
}

func (h *interviewCommentHandler) create(ctx context.Context, in *CreateInterviewCommentInput) (*InterviewCommentOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	comment, err := h.store.CreateInterviewComment(ctx, in.ID, currentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewCommentOutput{Body: comment}, nil
}

type UpdateInterviewCommentInput struct {
	ID        string `path:"id" doc:"Application ID"`
	CommentID string `path:"commentId" doc:"Comment ID"`
	Body      struct {
		Body string `json:"body" minLength:"1"`
	}
}

func (h *interviewCommentHandler) update(ctx context.Context, in *UpdateInterviewCommentInput) (*InterviewCommentOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	comment, err := h.store.UpdateInterviewComment(ctx, in.CommentID, currentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewCommentOutput{Body: comment}, nil
}
