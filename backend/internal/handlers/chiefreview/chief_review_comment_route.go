package chiefreview

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerChiefReviewComment(api huma.API, s *chiefReviewCommentService) {
	huma.Register(api, huma.Operation{
		OperationID: "list-chief-review-comments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/chief-review-comments",
		Summary:     "List an application's chief review comments",
		Description: "Chief only.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "create-chief-review-comment",
		Method:      http.MethodPost,
		Path:        "/applications/{id}/chief-review-comments",
		Summary:     "Add a chief review comment",
		Description: "Chief only. A chief may leave any number of comments on an application.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-chief-review-comment",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/chief-review-comments/{commentId}",
		Summary:     "Edit a chief review comment",
		Description: "Chief only, and only the comment's own author.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.update)
}
