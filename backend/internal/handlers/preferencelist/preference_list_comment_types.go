package preferencelist

import "github.com/GenerateNU/apportal/backend/internal/models"

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

type UpdatePreferenceListCommentInput struct {
	ID        string `path:"id" doc:"Preference list ID"`
	CommentID string `path:"commentId" doc:"Comment ID"`
	Body      struct {
		Body string `json:"body" minLength:"1"`
	}
}
