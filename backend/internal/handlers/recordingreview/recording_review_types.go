package recordingreview

import "github.com/GenerateNU/apportal/backend/internal/models"

type RecordingReviewOutput struct {
	Body models.InterviewRecordingReview
}

type RecordingReviewsOutput struct {
	Body []models.InterviewRecordingReview
}

type UpsertRecordingReviewInput struct {
	ID   string `path:"id" doc:"Interview ID"`
	Body struct {
		Comments *string                 `json:"comments,omitempty"`
		Rating   *models.InterviewRating `json:"rating,omitempty"`
		Submit   bool                    `json:"submit,omitempty" doc:"When true, marks the review as submitted"`
	}
}

type InterviewScopedInput struct {
	ID string `path:"id" doc:"Interview ID"`
}

type ListRecordingReviewsBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `interview_ids[]=…`, which binds to nothing server-side.
	InterviewIDs string `query:"interview_ids" doc:"Comma-separated interview IDs"`
}
