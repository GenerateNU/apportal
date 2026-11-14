package tag

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
)

func Route(api huma.API, db *gorm.DB) {
	s := &tagService{tagDB: NewTagDB(db), applicationDB: application.NewApplicationDB(db)}

	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-tags",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/tags",
		Summary:     "List a cycle's tags",
		Tags:        []string{"Tags"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-cycle-tag",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/tags",
		Summary:       "Create a tag in a cycle",
		Description:   "Lead, chief or admin. The color is assigned from the palette.",
		Tags:          []string{"Tags"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-tag",
		Method:      http.MethodPatch,
		Path:        "/tags/{id}",
		Summary:     "Rename or recolor a tag",
		Tags:        []string{"Tags"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-tag",
		Method:        http.MethodDelete,
		Path:          "/tags/{id}",
		Summary:       "Delete a tag",
		Description:   "Also removes it from every application in the cycle.",
		Tags:          []string{"Tags"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusNotFound},
	}, s.delete)

	huma.Register(api, huma.Operation{
		OperationID: "set-application-tags",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/tags",
		Summary:     "Replace an application's tags",
		Description: "Lead, chief or admin. At most 3 tags, all from the application's cycle.",
		Tags:        []string{"Tags"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.setApplicationTags)
}
