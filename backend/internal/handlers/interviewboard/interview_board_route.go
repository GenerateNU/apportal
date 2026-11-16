package interviewboard

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB) {
	register(api, newService(access.NewChecker(db), db))
}

func register(api huma.API, s *interviewBoardService) {
	tags := []string{"Interview planning"}
	errs := []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity}

	huma.Register(api, huma.Operation{
		OperationID: "get-interview-board", Method: http.MethodGet, Path: "/cycles/{id}/interview-board",
		Summary:     "Every applicant in interviews, with who interviews and reviews them",
		Description: "Chief or admin. One request for the whole board: interviewers, recording reviewers, names, scheduled time, progress and the applicant's meeting slots.",
		Tags:        tags, Errors: errs,
	}, s.board)
	huma.Register(api, huma.Operation{
		OperationID: "auto-plan-interviews", Method: http.MethodPost, Path: "/cycles/{id}/interview-plan/auto",
		Summary: "Plan interviewers (and optionally recording reviewers) for the openings",
		Description: "Chief or admin. Fills each applicant up to the cycle's counts, balanced across openings, from each opening's team, " +
			"skipping conflicts. by_panel assigns whole panels to applicants with no interviewer yet. With slot matching, people on a " +
			"slot the applicant can make come first; applicants who gave no slots are neither filtered nor flagged, and those with no " +
			"shared slot are assigned anyway and listed in no_slot_match. Recording reviewers are planned after interviewers and are " +
			"never the applicant's current or planned interviewers. Existing assignments are kept; with dry_run false the plan is saved in one transaction.",
		Tags: tags, Errors: append(errs, http.StatusConflict),
	}, s.autoPlan)
	huma.Register(api, huma.Operation{
		OperationID: "list-assignable-staff", Method: http.MethodGet, Path: "/cycles/{id}/assignable-staff",
		Summary:     "Who can be added to each applicant as a reviewer, interviewer or recording reviewer",
		Description: "Chief or admin. Every cycle staff member with their name for each application, marked available or with the reason they can't be added: already assigned, not on the opening's team, conflicted, interviewing when adding a recording reviewer (or the reverse), or the applicant is full. locked is set when the opening takes no adds right now.",
		Tags:        tags, Errors: errs,
	}, s.assignable)
}
