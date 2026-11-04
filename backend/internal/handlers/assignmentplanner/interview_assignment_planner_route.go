package assignmentplanner

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerInterviewAssignmentPlanner(api huma.API, s *interviewAssignmentPlannerService) {
	huma.Register(api, huma.Operation{
		OperationID: "get-interviewer-pool",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/interview-assignment-plan/interviewer/pool",
		Summary:     "Count the applications awaiting an interviewer",
		Description: "Chief only. Every application in the interview stage, for sizing caps " +
			"before any meeting days are declared.",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.interviewerPool)

	huma.Register(api, huma.Operation{
		OperationID: "suggest-interviewer-capacity",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/interviewer/capacity",
		Summary:     "Suggest a per-lead interview cap",
		Description: "Chief only. Read-only. Reports the minimum and suggested per-lead cap " +
			"for the cycle's interview-stage pool, given how many leads are available.",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.interviewerCapacity)

	huma.Register(api, huma.Operation{
		OperationID: "preview-interviewer-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/interviewer/preview",
		Summary:     "Preview interviewer assignments for a meeting-day roster",
		Description: "Chief only. Read-only — computes who would interview whom and returns " +
			"it without saving. Applications that already have an interviewer are left alone.",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.interviewerPreview)

	huma.Register(api, huma.Operation{
		OperationID: "commit-interviewer-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/interviewer/commit",
		Summary:     "Assign interviewers according to a plan",
		Description: "Chief only. Writes the plan's interviewer assignments. Recomputed " +
			"server-side against the pool as it stands now rather than trusting a supplied list.",
		Tags:          []string{"Interview assignment planning"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.interviewerCommit)

	huma.Register(api, huma.Operation{
		OperationID: "get-interview-reviewer-pool",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/interview-assignment-plan/reviewer/pool",
		Summary:     "Count the applications awaiting interview reviewers",
		Description: "Chief only. Interview-stage applications that already have an " +
			"interviewer assigned — applicants still needing an interviewer are not counted " +
			"here (assign an interviewer first).",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.reviewerPool)

	huma.Register(api, huma.Operation{
		OperationID: "suggest-interview-reviewer-capacity",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/reviewer/capacity",
		Summary:     "Suggest a per-lead interview-review cap",
		Tags:        []string{"Interview assignment planning"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.reviewerCapacity)

	huma.Register(api, huma.Operation{
		OperationID: "preview-interview-reviewer-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/reviewer/preview",
		Summary:     "Preview interview-review assignments for a meeting-day roster",
		Description: "Chief only. Read-only. Only considers applications that already have " +
			"an interviewer committed.",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.reviewerPreview)

	huma.Register(api, huma.Operation{
		OperationID:   "commit-interview-reviewer-plan",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/interview-assignment-plan/reviewer/commit",
		Summary:       "Assign interview reviewers according to a plan",
		Tags:          []string{"Interview assignment planning"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.reviewerCommit)
}
