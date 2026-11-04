package interviewassignment

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	interviewAssignmentDB := NewInterviewAssignmentDB(db)
	s := &interviewAssignmentService{interviewAssignmentDB: interviewAssignmentDB}

	huma.Register(api, huma.Operation{
		OperationID: "set-interview-assignment",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/interview-assignment",
		Summary:     "Assign the interviewer for an application",
		Description: "Chief only. One interviewer per application.",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.setInterviewer)

	huma.Register(api, huma.Operation{
		OperationID: "get-interview-assignment",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview-assignment",
		Summary:     "Get an application's interviewer assignment",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, s.getInterviewer)

	huma.Register(api, huma.Operation{
		OperationID: "list-interview-assignments-bulk",
		Method:      http.MethodGet,
		Path:        "/interview-assignments",
		Summary:     "List interviewer assignments for several applications",
		Description: "Reviewer only. One request for a page of applications, instead of one per application.",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.listInterviewerAssignmentsBulk)

	huma.Register(api, huma.Operation{
		OperationID: "list-interview-review-assignments-bulk",
		Method:      http.MethodGet,
		Path:        "/interview-review-assignments",
		Summary:     "List recording-reviewer assignments for several applications",
		Description: "Reviewer only. One request for a page of applications, instead of one per application.",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.listReviewerAssignmentsBulk)

	huma.Register(api, huma.Operation{
		OperationID:   "assign-recording-reviewer",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/interview-review-assignments",
		Summary:       "Assign a lead to review the interview recording",
		Description:   "Chief only. Chiefs assign 2 leads per interview.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, s.assignReviewer)

	huma.Register(api, huma.Operation{
		OperationID: "list-recording-reviewer-assignments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview-review-assignments",
		Summary:     "List recording-review assignments",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.listReviewers)

	huma.Register(api, huma.Operation{
		OperationID:   "unassign-recording-reviewer",
		Method:        http.MethodDelete,
		Path:          "/interview-review-assignments/{id}",
		Summary:       "Remove a recording-review assignment",
		Description:   "Chief only.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.unassignReviewer)

	huma.Register(api, huma.Operation{
		OperationID: "unassign-all-interviewers",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/interview-assignments",
		Summary:     "Remove every interviewer assignment for a cycle's role",
		Description: "Chief only. Deletes all interviewer assignments for one applicant " +
			"role in a cycle at once. Cannot be undone.",
		Tags:   []string{"Interview assignments"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.unassignAllInterviewers)

	huma.Register(api, huma.Operation{
		OperationID: "unassign-all-recording-reviewers",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/interview-review-assignments",
		Summary:     "Remove every recording-review assignment for a cycle's role",
		Description: "Chief only. Deletes all recording-review assignments for one " +
			"applicant role in a cycle at once. Cannot be undone.",
		Tags:   []string{"Interview assignments"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.unassignAllReviewers)
}
