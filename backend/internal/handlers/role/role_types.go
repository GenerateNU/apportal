package role

import "github.com/GenerateNU/apportal/backend/internal/models"

type RoleOutput struct {
	Body models.Role
}

type RolesOutput struct {
	Body []models.Role
}

type ListRolesInput struct {
	CycleID string `query:"cycle_id" doc:"Optional cycle filter"`
}

type RoleIDInput struct {
	ID string `path:"id"`
}

type CreateRoleInput struct {
	Body struct {
		CycleID string `json:"cycle_id"`
		Name    string `json:"name"`
	}
}

type UpdateRoleInput struct {
	ID   string `path:"id"`
	Body struct {
		Name *string `json:"name,omitempty"`
	}
}

// RoleUpdate carries partial-update fields; nil pointers are left unchanged.
type RoleUpdate struct {
	Name *string
}
