package assignmentplanner

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/leadassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	applicationDB := application.NewApplicationDB(db)
	interviewAssignmentDB := interviewassignment.NewInterviewAssignmentDB(db)
	leadAssignmentDB := leadassignment.NewLeadAssignmentDB(db)
	userDB := user.NewUserDB(db)

	registerAssignmentPlanner(api, &assignmentPlannerService{applicationDB: applicationDB, leadAssignmentDB: leadAssignmentDB, userDB: userDB})
	registerInterviewAssignmentPlanner(api, &interviewAssignmentPlannerService{applicationDB: applicationDB, interviewAssignmentDB: interviewAssignmentDB, leadAssignmentDB: leadAssignmentDB, userDB: userDB})
}

func registerAssignmentPlanner(api huma.API, s *assignmentPlannerService) {
	huma.Register(api, huma.Operation{
		OperationID: "suggest-assignment-capacity",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/assignment-plan/capacity",
		Summary:     "Suggest a per-lead review cap for a team layout",
		Description: "Chief only. Read-only. Given teams and a coverage target, reports the " +
			"minimum and suggested per-lead cap for the cycle's unreviewed pool. Because two " +
			"leads on the same team never review the same application, a team can absorb at " +
			"most one review per application — so the minimum cap can exceed a naive even split.",
		Tags:   []string{"Assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.capacity)

	huma.Register(api, huma.Operation{
		OperationID: "preview-assignment-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/assignment-plan/preview",
		Summary:     "Preview lead review assignments for a team layout",
		Description: "Chief only. Read-only — computes which applications each lead would " +
			"review and returns them without saving. Existing assignments are treated as " +
			"fixed: the plan only adds what is missing.",
		Tags:   []string{"Assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.preview)

	huma.Register(api, huma.Operation{
		OperationID: "commit-assignment-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/assignment-plan/commit",
		Summary:     "Assign leads according to a plan",
		Description: "Chief only. Writes the plan's assignments. The plan is recomputed " +
			"server-side against the pool as it stands now rather than trusting a supplied " +
			"list, and existing assignments are never deleted or reassigned — so committing " +
			"the same plan twice creates nothing the second time.",
		Tags:          []string{"Assignment planning"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.commit)

	huma.Register(api, huma.Operation{
		OperationID: "get-assignment-pool",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/assignment-plan/pool",
		Summary:     "Count the applications awaiting lead review",
		Description: "Chief only. The size of the pool a plan would cover, for sizing caps " +
			"before any teams are built.",
		Tags:   []string{"Assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.pool)
}
