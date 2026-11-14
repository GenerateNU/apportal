package application

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerComment(api huma.API, s *commentService) {
	huma.Register(api, huma.Operation{
		OperationID: "list-application-comments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/comments",
		Summary:     "List an application's comments",
		Description: "Reviewer only.",
		Tags:        []string{"Application comments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "list-application-comments-bulk",
		Method:      http.MethodGet,
		Path:        "/comments",
		Summary:     "List comments for several applications",
		Description: "Reviewer only. One request for a page of applications, instead of one per application.",
		Tags:        []string{"Application comments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.listBulk)

	huma.Register(api, huma.Operation{
		OperationID:   "create-application-comment",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/comments",
		Summary:       "Comment on an application",
		Description:   "Reviewer only. Any reviewer may leave any number of comments.",
		Tags:          []string{"Application comments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-application-comment",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/comments/{commentId}",
		Summary:     "Edit an application comment",
		Description: "Reviewer only, and only the comment's own author.",
		Tags:        []string{"Application comments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.update)
}
