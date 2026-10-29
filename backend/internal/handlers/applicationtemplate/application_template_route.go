package applicationtemplate

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	applicationTemplateDB := NewApplicationTemplateDB(db)
	s := &applicationTemplateService{applicationTemplateDB: applicationTemplateDB}

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
		Description: "?role= selects which role's template to fetch (required). Creates a default-titled row on first access.",
		Tags:        []string{"Application Templates"},
		Errors:      []int{http.StatusUnprocessableEntity},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID: "update-application-template",
		Method:      http.MethodPatch,
		Path:        "/cycles/{id}/template",
		Summary:     "Update a cycle's per-role application template",
		Description: "Chief only. ?role= selects which role's template to update (required).",
		Tags:        []string{"Application Templates"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity, http.StatusNotFound},
	}, s.update)
}
