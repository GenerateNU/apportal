package role

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	s := &roleService{roleDB: NewRoleDB(db)}

	huma.Register(api, huma.Operation{
		OperationID: "list-roles",
		Method:      http.MethodGet,
		Path:        "/roles",
		Summary:     "List roles",
		Description: "Optional ?cycle_id= filters to one cycle.",
		Tags:        []string{"Roles"},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "get-role",
		Method:      http.MethodGet,
		Path:        "/roles/{id}",
		Summary:     "Get a role",
		Tags:        []string{"Roles"},
		Errors:      []int{http.StatusNotFound},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID:   "create-role",
		Method:        http.MethodPost,
		Path:          "/roles",
		Summary:       "Create a role in a cycle",
		Description:   "Chief only. Names are unique within a cycle.",
		Tags:          []string{"Roles"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-role",
		Method:      http.MethodPatch,
		Path:        "/roles/{id}",
		Summary:     "Rename a role",
		Description: "Chief only.",
		Tags:        []string{"Roles"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict},
	}, s.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-role",
		Method:        http.MethodDelete,
		Path:          "/roles/{id}",
		Summary:       "Delete a role",
		Description:   "Chief only. 409 while applications or cycle config still use it.",
		Tags:          []string{"Roles"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict},
	}, s.delete)
}
