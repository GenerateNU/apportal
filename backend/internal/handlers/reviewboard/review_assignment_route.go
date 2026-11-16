package reviewboard

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerReviewAssignment(api huma.API, s *reviewService) {
	errs := []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity}

	huma.Register(api, huma.Operation{
		OperationID: "get-review-board",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-board",
		Summary:     "Applicants in review, with their reviewers",
		Description: "Chief only. Every submitted, lead-review and chief-review applicant on the cycle in one call.",
		Tags:        []string{"Assignment planning"},
		Errors:      errs,
	}, s.reviewBoard)

	huma.Register(api, huma.Operation{
		OperationID: "auto-assign-reviewers",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/assignment-plan/auto",
		Summary:     "Assign reviewers across openings",
		Description: "Chief only. Tops every waiting applicant up to the cycle's reviewers-each count, balancing load " +
			"across every opening and skipping conflicts and openings whose next step has started. " +
			"Keeps existing assignments. dry_run plans without saving.",
		Tags:   []string{"Assignment planning"},
		Errors: errs,
	}, s.autoAssign)
}
