package reviewquestion

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/workflow"

	"github.com/GenerateNU/apportal/backend/internal/handlers/cyclestaff"
)

func Route(api huma.API, db *gorm.DB) {
	reviewQuestionDB := NewReviewQuestionDB(db)

	registerReviewQuestionAverage(api, &reviewQuestionAverageService{access: access.NewChecker(db), reviewQuestionDB: reviewQuestionDB, staffDB: cyclestaff.NewCycleStaffDB(db)})
	registerReviewQuestion(api, &reviewQuestionService{access: access.NewChecker(db), reviewQuestionDB: reviewQuestionDB, roleDB: role.NewRoleDB(db), workflow: workflow.NewService(db)})
}

func registerReviewQuestion(api huma.API, s *reviewQuestionService) {
	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-review-questions",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-questions",
		Summary:     "List a cycle's review questions",
		Description: "Reviewer only. Optional ?role_id= returns that role's questions plus global ones.",
		Tags:        []string{"Review questions"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-review-question",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/review-questions",
		Summary:       "Create a review question",
		Description:   "Chief only.",
		Tags:          []string{"Review questions"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-review-question",
		Method:      http.MethodPatch,
		Path:        "/review-questions/{id}",
		Summary:     "Update a review question",
		Description: "Chief only.",
		Tags:        []string{"Review questions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-review-question",
		Method:        http.MethodDelete,
		Path:          "/review-questions/{id}",
		Summary:       "Delete a review question",
		Description:   "Chief only.",
		Tags:          []string{"Review questions"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.delete)
}
