package leadassignment

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/cyclestaff"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
)

func Route(api huma.API, db *gorm.DB) {
	leadAssignmentDB := NewLeadAssignmentDB(db)

	registerLeadAssignment(api, &leadAssignmentService{access: access.NewChecker(db), db: leadAssignmentDB, guard: staffing.NewGuard()})
	registerReviewerProgress(api, &reviewerProgressService{access: access.NewChecker(db), leadAssignmentDB: leadAssignmentDB, staffDB: cyclestaff.NewCycleStaffDB(db)})
}

func registerLeadAssignment(api huma.API, s *leadAssignmentService) {
	huma.Register(api, huma.Operation{
		OperationID: "assign-lead",
		Method:      http.MethodPost,
		Path:        "/applications/{id}/lead-assignments",
		Summary:     "Assign a lead to write-review an application",
		Description: "Chief only. The lead must be on the opening's reviewer team, have no conflict with the applicant, " +
			"and the applicant must be submitted or in review and below the Reviews step's reviewers-each count. " +
			"Once Reviews is released it is an override confirmed with confirm_override=true.",
		Tags:          []string{"Lead assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "list-lead-assignments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/lead-assignments",
		Summary:     "List an application's lead assignments",
		Tags:        []string{"Lead assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID:   "unassign-lead",
		Method:        http.MethodDelete,
		Path:          "/lead-assignments/{id}",
		Summary:       "Remove a lead assignment",
		Description:   "Chief only. Once Reviews is released, removing someone is destructive and needs confirm_override=true.",
		Tags:          []string{"Lead assignments"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.delete)

	huma.Register(api, huma.Operation{
		OperationID: "unassign-all-leads",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/lead-assignments",
		Summary:     "Remove every lead assignment for a cycle's role",
		Description: "Chief only. Deletes all written-review lead assignments " +
			"for one applicant role in a cycle at once, except ones whose review is submitted. " +
			"Once Reviews is released this is destructive and needs confirm_override=true. Cannot be undone.",
		Tags:   []string{"Lead assignments"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.deleteAll)
}
