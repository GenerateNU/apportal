package reviewscoring

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	s := &reviewScoringService{db: NewReviewScoringDB(db)}

	huma.Register(api, huma.Operation{
		OperationID: "get-review-rubric",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-rubric",
		Summary:     "Get a cycle's written-review rubric",
		Description: "Any reviewer. Says whether score questions are rated on a number range or with categories.",
		Tags:        []string{"Review scoring"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.getRubric)

	huma.Register(api, huma.Operation{
		OperationID: "update-review-rubric",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/review-rubric",
		Summary:     "Replace a cycle's written-review rubric",
		Description: "Chief only. Rejected once any lead has rated an answer in the cycle.",
		Tags:        []string{"Review scoring"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.putRubric)

	huma.Register(api, huma.Operation{
		OperationID: "get-review-scoring-settings",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-scoring-settings",
		Summary:     "Get normalizing and cutoff settings for a cycle and role",
		Description: "Chief only. Returns defaults (normalize off, no cutoff) when none are saved.",
		Tags:        []string{"Review scoring"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.getSettings)

	huma.Register(api, huma.Operation{
		OperationID: "update-review-scoring-settings",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/review-scoring-settings",
		Summary:     "Save normalizing and cutoff settings for a cycle and role",
		Description: "Chief only.",
		Tags:        []string{"Review scoring"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.putSettings)

	huma.Register(api, huma.Operation{
		OperationID: "list-review-scores",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-scores",
		Summary:     "Score every reviewed application in a cycle and role",
		Description: "Chief only. Uses submitted written reviews' score questions, best first.",
		Tags:        []string{"Review scoring"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.scores)
}
