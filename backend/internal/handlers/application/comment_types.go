package application

import "github.com/GenerateNU/apportal/backend/internal/models"

type CommentOutput struct {
	Body models.ApplicationCommentDetail
}

type CommentsOutput struct {
	Body []models.ApplicationCommentDetail
}

type ListCommentsBulkInput struct {
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

type CreateCommentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Body string `json:"body" minLength:"1"`
	}
}

type UpdateCommentInput struct {
	ID        string `path:"id" doc:"Application ID"`
	CommentID string `path:"commentId" doc:"Comment ID"`
	Body      struct {
		Body string `json:"body" minLength:"1"`
	}
}
