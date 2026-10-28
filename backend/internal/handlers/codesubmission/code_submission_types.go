package codesubmission

import "github.com/GenerateNU/apportal/backend/internal/models"

type CodeSubmissionOutput struct {
	Body models.CodeSubmission
}

type CodeSubmissionsOutput struct {
	Body []models.CodeSubmission
}

type UpsertCodeSubmissionInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		ChallengeID   string `json:"challenge_id"`
		SubmissionURL string `json:"submission_url"`
	}
}

type CodeSubmissionAppInput struct {
	ID string `path:"id" doc:"Application ID"`
}
