package writtenreview

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/workflow"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB) {
	writtenReviewDB := NewWrittenReviewDB(db)
	s := &writtenReviewService{access: access.NewChecker(db), writtenReviewDB: writtenReviewDB, workflow: workflow.NewService(db)}

	huma.Register(api, huma.Operation{
		OperationID: "upsert-written-review",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/written-review",
		Summary:     "Submit or update your written review",
		Description: "Reviewer only; upserts the calling reviewer's review-question answers.",
		Tags:        []string{"Written reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-written-reviews",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/written-reviews",
		Summary:     "List an application's written reviews",
		Description: "Leads see only their own review until a chief releases the cycle's written reviews; chiefs and admins always see every review.",
		Tags:        []string{"Written reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "list-written-reviews-bulk",
		Method:      http.MethodGet,
		Path:        "/written-reviews",
		Summary:     "List written reviews for several applications",
		Description: "Same visibility as the single-application route; applications the caller can't review are left out.",
		Tags:        []string{"Written reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.listBulk)
}
