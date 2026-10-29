package reviewrelease

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	reviewReleaseDB := NewReviewReleaseDB(db)
	s := &reviewReleaseService{reviewReleaseDB: reviewReleaseDB}

	huma.Register(api, huma.Operation{
		OperationID: "list-review-gates",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-gates",
		Summary:     "Review release status and progress for a cycle",
		Description: "Reviewer only. One entry per applicant role × review kind (written, recording): how many reviewers are assigned, how many have submitted, and whether reviews have been released to everyone.",
		Tags:        []string{"Review releases"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "set-review-release",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/review-gates",
		Summary:     "Release or hide a cycle's reviews for a role",
		Description: "Chief only. Releases (reveals to all reviewers) or hides a cycle's reviews of the given kind for one applicant role. May be done at any point, before all reviewers have submitted. Idempotent.",
		Tags:        []string{"Review releases"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.set)
}
