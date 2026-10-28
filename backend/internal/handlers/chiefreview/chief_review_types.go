package chiefreview

import "github.com/GenerateNU/apportal/backend/internal/models"

type ListChiefReviewsBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

type ChiefReviewOutput struct {
	Body models.ChiefReviewDetail
}

type ChiefReviewsOutput struct {
	Body []models.ChiefReviewDetail
}

type UpsertChiefReviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Vote *models.ChiefVote `json:"vote,omitempty"`
	}
}
