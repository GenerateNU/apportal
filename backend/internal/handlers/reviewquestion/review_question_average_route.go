package reviewquestion

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerReviewQuestionAverage(api huma.API, s *reviewQuestionAverageService) {
	huma.Register(api, huma.Operation{
		OperationID: "list-review-question-averages",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-question-averages",
		Summary:     "Per-lead average score on each review question for a cycle",
		Description: "Chief only. One entry per lead with a role='lead' account, " +
			"listing their average score on each of the cycle/role's score-type " +
			"review questions.",
		Tags:   []string{"Review releases"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.list)
}
