package question

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	questionDB := NewQuestionDB(db)
	s := &questionService{questionDB: questionDB}

	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-questions",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/questions",
		Summary:     "List a cycle's questions",
		Description: "Optional ?role= returns that role's questions plus global ones.",
		Tags:        []string{"Questions"},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-question",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/questions",
		Summary:       "Create a question",
		Description:   "Chief only.",
		Tags:          []string{"Questions"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-question",
		Method:      http.MethodPatch,
		Path:        "/questions/{id}",
		Summary:     "Update a question",
		Description: "Chief only.",
		Tags:        []string{"Questions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-question",
		Method:        http.MethodDelete,
		Path:          "/questions/{id}",
		Summary:       "Delete a question",
		Description:   "Chief only.",
		Tags:          []string{"Questions"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.delete)
}
