package recordingreview

import "github.com/GenerateNU/apportal/backend/internal/models"

type RecordingReviewsOutput struct {
	Body []models.InterviewReviewerDetail
}

type UpsertRecordingReviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Writeup *string                 `json:"writeup,omitempty"`
		Rating  *models.InterviewRating `json:"rating,omitempty" doc:"Sets the interview's shared rating"`
		Submit  bool                    `json:"submit,omitempty" doc:"When true, submits your review"`
	}
}

type RecordingReviewUpsert struct {
	ApplicationID string
	ReviewerNUID  string
	Writeup       *string
	Rating        *models.InterviewRating
	Submit        bool
}
