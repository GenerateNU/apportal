package selection

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	selectionDB := NewSelectionDB(db)
	s := &selectionService{selectionDB: selectionDB}

	huma.Register(api, huma.Operation{
		OperationID: "select-application",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/selection",
		Summary:     "Mark an application as wanted for your team",
		Description: "Reviewer only; upserts the calling lead's selection of this application.",
		Tags:        []string{"Selections"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID:   "deselect-application",
		Method:        http.MethodDelete,
		Path:          "/applications/{id}/selection",
		Summary:       "Remove your selection of an application",
		Tags:          []string{"Selections"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusNotFound},
	}, s.delete)

	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-selections",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/selections",
		Summary:     "List a cycle's lead selections",
		Description: "Optional ?lead_nuid= filters to one lead.",
		Tags:        []string{"Selections"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.list)
}
