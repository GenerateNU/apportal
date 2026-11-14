package branch

import "github.com/GenerateNU/apportal/backend/internal/models"

type BranchOutput struct {
	Body models.Branch
}

type BranchesOutput struct {
	Body []models.Branch
}

type ListBranchesInput struct{}

type BranchIDInput struct {
	ID string `path:"id"`
}

type CreateBranchInput struct {
	Body struct {
		Name string `json:"name"`
	}
}

type UpdateBranchInput struct {
	ID   string `path:"id"`
	Body struct {
		Name *string `json:"name,omitempty"`
	}
}

// BranchUpdate carries partial-update fields; nil pointers are left unchanged.
type BranchUpdate struct {
	Name *string
}
