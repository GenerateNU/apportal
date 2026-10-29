package leadassignment

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	applicationDB := application.NewApplicationDB(db)
	leadAssignmentDB := NewLeadAssignmentDB(db)
	userDB := user.NewUserDB(db)

	registerLeadAssignment(api, &leadAssignmentService{applicationDB: applicationDB, leadAssignmentDB: leadAssignmentDB})
	registerReviewerProgress(api, &reviewerProgressService{leadAssignmentDB: leadAssignmentDB, userDB: userDB})
}

func registerLeadAssignment(api huma.API, s *leadAssignmentService) {
	huma.Register(api, huma.Operation{
		OperationID:   "assign-lead",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/lead-assignments",
		Summary:       "Assign a lead to write-review an application",
		Description:   "Chief only. Chiefs assign 3 leads per application.",
		Tags:          []string{"Lead assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "list-lead-assignments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/lead-assignments",
		Summary:     "List an application's lead assignments",
		Tags:        []string{"Lead assignments"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID:   "unassign-lead",
		Method:        http.MethodDelete,
		Path:          "/lead-assignments/{id}",
		Summary:       "Remove a lead assignment",
		Description:   "Chief only.",
		Tags:          []string{"Lead assignments"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.delete)

	huma.Register(api, huma.Operation{
		OperationID: "unassign-all-leads",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/lead-assignments",
		Summary:     "Remove every lead assignment for a cycle's role",
		Description: "Chief only. Deletes all written-review lead assignments " +
			"for one applicant role in a cycle at once. Cannot be undone.",
		Tags:   []string{"Lead assignments"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.deleteAll)
}
