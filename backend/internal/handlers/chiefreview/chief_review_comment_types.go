package chiefreview

import "github.com/GenerateNU/apportal/backend/internal/models"

type ChiefReviewCommentOutput struct {
	Body models.ChiefReviewCommentDetail
}

type ChiefReviewCommentsOutput struct {
	Body []models.ChiefReviewCommentDetail
}

type CreateChiefReviewCommentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Body string `json:"body" minLength:"1"`
	}
}

type UpdateChiefReviewCommentInput struct {
	ID        string `path:"id" doc:"Application ID"`
	CommentID string `path:"commentId" doc:"Comment ID"`
	Body      struct {
		Body string `json:"body" minLength:"1"`
	}
}
