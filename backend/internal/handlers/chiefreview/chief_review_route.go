package chiefreview

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	chiefReviewDB := NewChiefReviewDB(db)

	registerChiefReviewComment(api, &chiefReviewCommentService{chiefReviewDB: chiefReviewDB})
	registerChiefReview(api, &chiefReviewService{chiefReviewDB: chiefReviewDB})
}

func registerChiefReview(api huma.API, s *chiefReviewService) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-chief-review",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/chief-review",
		Summary:     "Submit or update your chief review",
		Description: "Chief only. Setting vote records this chief's vote.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-chief-reviews",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/chief-reviews",
		Summary:     "List an application's chief reviews",
		Description: "Chief only.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "list-chief-reviews-bulk",
		Method:      http.MethodGet,
		Path:        "/chief-reviews",
		Summary:     "List chief reviews for several applications",
		Description: "Chief only. One request for a page of applications, instead of one per application.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.listBulk)
}
