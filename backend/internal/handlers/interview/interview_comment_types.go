package interview

import "github.com/GenerateNU/apportal/backend/internal/models"

type InterviewCommentOutput struct {
	Body models.InterviewCommentDetail
}

type InterviewCommentsOutput struct {
	Body []models.InterviewCommentDetail
}

type CreateInterviewCommentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Body string `json:"body" minLength:"1"`
	}
}

type UpdateInterviewCommentInput struct {
	ID        string `path:"id" doc:"Application ID"`
	CommentID string `path:"commentId" doc:"Comment ID"`
	Body      struct {
		Body string `json:"body" minLength:"1"`
	}
}
