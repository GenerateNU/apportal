package leadassignment

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerReviewerProgress(api huma.API, s *reviewerProgressService) {
	huma.Register(api, huma.Operation{
		OperationID: "list-reviewer-progress",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/reviewer-progress",
		Summary:     "Per-reviewer written-review progress for a cycle",
		Description: "Chief only. One entry per lead with any assignment or " +
			"role='lead' account, listing every application assigned to them " +
			"and whether their written review is submitted.",
		Tags:   []string{"Review releases"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.list)
}
