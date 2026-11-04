package interview

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerInterviewComment(api huma.API, s *interviewCommentService) {
	huma.Register(api, huma.Operation{
		OperationID: "list-interview-comments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview-comments",
		Summary:     "List an application's interview comments",
		Description: "Reviewer only. Open to any reviewer, not just the assigned interviewer/chief.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "create-interview-comment",
		Method:      http.MethodPost,
		Path:        "/applications/{id}/interview-comments",
		Summary:     "Add an interview comment",
		Description: "Reviewer only. Any reviewer may leave any number of comments on an application.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-interview-comment",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/interview-comments/{commentId}",
		Summary:     "Edit an interview comment",
		Description: "Reviewer only, and only the comment's own author.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.update)
}
