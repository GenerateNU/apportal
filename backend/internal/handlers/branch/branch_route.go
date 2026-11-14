package branch

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	s := &branchService{branchDB: NewBranchDB(db)}

	huma.Register(api, huma.Operation{
		OperationID: "list-branches",
		Method:      http.MethodGet,
		Path:        "/branches",
		Summary:     "List branches",
		Tags:        []string{"Branches"},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "get-branch",
		Method:      http.MethodGet,
		Path:        "/branches/{id}",
		Summary:     "Get a branch",
		Tags:        []string{"Branches"},
		Errors:      []int{http.StatusNotFound},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID:   "create-branch",
		Method:        http.MethodPost,
		Path:          "/branches",
		Summary:       "Create a branch",
		Description:   "Chief only. Names are unique.",
		Tags:          []string{"Branches"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-branch",
		Method:      http.MethodPatch,
		Path:        "/branches/{id}",
		Summary:     "Rename a branch",
		Description: "Chief only.",
		Tags:        []string{"Branches"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict},
	}, s.update)
}
