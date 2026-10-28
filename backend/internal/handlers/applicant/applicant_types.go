package applicant

import "github.com/GenerateNU/apportal/backend/internal/models"

type ApplicantOutput struct {
	Body models.Applicant
}

type UpsertApplicantInput struct {
	Body struct {
		NUID           string  `json:"nuid" minLength:"1"`
		Email          string  `json:"email" format:"email"`
		FullName       string  `json:"full_name" minLength:"1"`
		GithubUsername *string `json:"github_username,omitempty"`
		GraduationYear *int    `json:"graduation_year,omitempty"`
		Major          *string `json:"major,omitempty"`
	}
}

type ApplicantNUIDInput struct {
	NUID string `path:"nuid"`
}
