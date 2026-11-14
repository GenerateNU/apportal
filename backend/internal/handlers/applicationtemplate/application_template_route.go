package applicationtemplate

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
)

func Route(api huma.API, db *gorm.DB) {
	applicationTemplateDB := NewApplicationTemplateDB(db)
	s := &applicationTemplateService{applicationTemplateDB: applicationTemplateDB, roleDB: role.NewRoleDB(db)}

	huma.Register(api, huma.Operation{
		OperationID: "list-open-application-templates",
		Method:      http.MethodGet,
		Path:        "/application-templates/open",
		Summary:     "List application templates currently open to applicants",
		Description: "A row is included only when both its own status and its owning cycle's status are \"open\".",
		Tags:        []string{"Application Templates"},
	}, s.listOpen)

	huma.Register(api, huma.Operation{
		OperationID: "get-application-template",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/template",
		Summary:     "Get a cycle's per-role application template",
		Description: "?role_id= selects which role's template to fetch (required). Creates a default-titled row on first access.",
		Tags:        []string{"Application Templates"},
		Errors:      []int{http.StatusUnprocessableEntity},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID: "update-application-template",
		Method:      http.MethodPatch,
		Path:        "/cycles/{id}/template",
		Summary:     "Update a cycle's per-role application template",
		Description: "Chief only. ?role_id= selects which role's template to update (required).",
		Tags:        []string{"Application Templates"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity, http.StatusNotFound},
	}, s.update)
}
