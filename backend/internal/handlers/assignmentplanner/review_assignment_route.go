package assignmentplanner

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerReviewAssignment(api huma.API, s *reviewService) {
	errs := []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity}

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
		OperationID: "list-review-conflicts",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-conflicts",
		Summary:     "Staff who must not review or interview an applicant",
		Description: "Chief only. Applies to every opening on the cycle, for reviews and interviews.",
		Tags:        []string{"Assignment planning"},
		Errors:      errs,
	}, s.conflicts)

	huma.Register(api, huma.Operation{
		OperationID: "add-review-conflict",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/review-conflicts/{lead_nuid}/{applicant_nuid}",
		Summary:     "Keep a staff member away from an applicant",
		Description: "Chief only. Idempotent. The lead must be on the cycle's staff and the applicant must have applied. Returns the updated list.",
		Tags:        []string{"Assignment planning"},
		Errors:      errs,
	}, s.addConflict)

	huma.Register(api, huma.Operation{
		OperationID: "remove-review-conflict",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/review-conflicts/{lead_nuid}/{applicant_nuid}",
		Summary:     "Remove a conflict",
		Description: "Chief only. Idempotent. Returns the updated list.",
		Tags:        []string{"Assignment planning"},
		Errors:      errs,
	}, s.removeConflict)

	huma.Register(api, huma.Operation{
		OperationID: "auto-assign-reviewers",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/assignment-plan/auto",
		Summary:     "Assign reviewers across openings",
		Description: "Chief only. Tops every waiting applicant up to the cycle's reviewers-each count, balancing load " +
			"across every opening and skipping conflicts. Keeps existing assignments. dry_run plans without saving.",
		Tags:   []string{"Assignment planning"},
		Errors: errs,
	}, s.autoAssign)
}
