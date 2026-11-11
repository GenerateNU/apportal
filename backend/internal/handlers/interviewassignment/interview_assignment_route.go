package interviewassignment

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	s := &interviewAssignmentService{interviewAssignmentDB: NewInterviewAssignmentDB(db)}

	huma.Register(api, huma.Operation{
		OperationID:   "add-interviewer",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/interviewers",
		Summary:       "Add an interviewer to an application",
		Description:   "Chief only. Creates the interview if it doesn't exist yet.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.addInterviewer)

	huma.Register(api, huma.Operation{
		OperationID:   "remove-interviewer",
		Method:        http.MethodDelete,
		Path:          "/interviewers/{id}",
		Summary:       "Remove an interviewer",
		Description:   "Chief only. Not allowed once the interview has been conducted.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict},
	}, s.removeInterviewer)

	huma.Register(api, huma.Operation{
		OperationID: "unassign-all-interviewers",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/interviewers",
		Summary:     "Remove every interviewer for a cycle's role",
		Description: "Chief only. Skips interviews that have already been conducted.",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.unassignAllInterviewers)

	huma.Register(api, huma.Operation{
		OperationID:   "add-interview-reviewer",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/interview-reviewers",
		Summary:       "Add a recording reviewer to an application",
		Description:   "Chief only. Creates the interview if it doesn't exist yet.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.addReviewer)

	huma.Register(api, huma.Operation{
		OperationID:   "remove-interview-reviewer",
		Method:        http.MethodDelete,
		Path:          "/interview-reviewers/{id}",
		Summary:       "Remove a recording reviewer",
		Description:   "Chief only. Not allowed once the reviewer has submitted.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict},
	}, s.removeReviewer)

	huma.Register(api, huma.Operation{
		OperationID: "list-interview-reviewers-bulk",
		Method:      http.MethodGet,
		Path:        "/interview-reviewers",
		Summary:     "List recording reviewers for several applications",
		Description: "Reviewer only. Write-ups are omitted except the caller's own; read them from list-interview-reviewers.",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.listReviewersBulk)

	huma.Register(api, huma.Operation{
		OperationID: "unassign-all-interview-reviewers",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/interview-reviewers",
		Summary:     "Remove every recording reviewer for a cycle's role",
		Description: "Chief only. Skips reviewers who have already submitted.",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.unassignAllReviewers)
}
