package reviewquestion

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	reviewQuestionDB := NewReviewQuestionDB(db)
	userDB := user.NewUserDB(db)

	registerReviewQuestionAverage(api, &reviewQuestionAverageService{reviewQuestionDB: reviewQuestionDB, userDB: userDB})
	registerReviewQuestion(api, &reviewQuestionService{reviewQuestionDB: reviewQuestionDB})
}

func registerReviewQuestion(api huma.API, s *reviewQuestionService) {
	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-review-questions",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-questions",
		Summary:     "List a cycle's review questions",
		Description: "Reviewer only. Optional ?role= returns that role's questions plus global ones.",
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
