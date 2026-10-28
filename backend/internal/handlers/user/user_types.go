package user

import "github.com/GenerateNU/apportal/backend/internal/models"

type UserOutput struct {
	Body models.User
}

type UsersOutput struct {
	Body struct {
		Users   []models.User `json:"users"`
		HasMore bool          `json:"has_more" doc:"True if more results exist beyond this page"`
	}
}

type CreateUserInput struct {
	Body struct {
		NUID           string            `json:"nuid" minLength:"1"`
		Email          string            `json:"email" format:"email"`
		FullName       string            `json:"full_name" minLength:"1"`
		Roles          []models.UserRole `json:"roles,omitempty" doc:"Omit to default to applicant"`
		GraduationYear *int              `json:"graduation_year,omitempty"`
		Major          *string           `json:"major,omitempty"`
		GithubUsername *string           `json:"github_username,omitempty"`
	}
}

type ListUsersInput struct {
	Role   string `query:"role" doc:"Optional role filter"`
	Limit  int    `query:"limit" doc:"Max results per page; omit (or 0) to return all matching users"`
	Offset int    `query:"offset" doc:"Number of results to skip"`
}

type UserNUIDInput struct {
	NUID string `path:"nuid"`
}

type MeInput struct{}

type UpdateUserInput struct {
	NUID string `path:"nuid"`
	Body struct {
		Email          *string           `json:"email,omitempty" format:"email"`
		FullName       *string           `json:"full_name,omitempty" minLength:"1"`
		Roles          []models.UserRole `json:"roles,omitempty"`
		GraduationYear *int              `json:"graduation_year,omitempty"`
		Major          *string           `json:"major,omitempty"`
		GithubUsername *string           `json:"github_username,omitempty"`
		Returner       *bool             `json:"returner,omitempty" doc:"Marks someone who has worked on a Generate project before"`
	}
}
