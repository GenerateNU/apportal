package reviewranking

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
)

func Route(api huma.API, db *gorm.DB) {
	s := &rankingService{access: access.NewChecker(db), rankingDB: NewRankingDB(db), roleDB: role.NewRoleDB(db)}

	huma.Register(api, huma.Operation{
		OperationID: "get-review-ranking",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-ranking",
		Summary:     "Rank a cycle role's applications by normalized written-review score",
		Description: "Chief only. Scores are z-scored per reviewer and question, so harsh and lenient " +
			"reviewers count equally. Each entry is marked against the saved cutoff, then any chief override.",
		Tags:   []string{"Review ranking"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID: "put-review-cutoff",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/review-cutoff",
		Summary:     "Set a cycle role's review cutoff",
		Description: "Chief only. min_score keeps applications at or above a normalized score; top_n keeps the N highest ranked.",
		Tags:        []string{"Review ranking"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.putCutoff)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-review-cutoff",
		Method:        http.MethodDelete,
		Path:          "/cycles/{id}/review-cutoff",
		Summary:       "Clear a cycle role's review cutoff",
		Description:   "Chief only.",
		Tags:          []string{"Review ranking"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.deleteCutoff)

	huma.Register(api, huma.Operation{
		OperationID: "put-review-cutoff-override",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/review-cutoff-override",
		Summary:     "Manually include or exclude an application from the cutoff list",
		Description: "Chief only. Survives cutoff changes until deleted.",
		Tags:        []string{"Review ranking"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.putOverride)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-review-cutoff-override",
		Method:        http.MethodDelete,
		Path:          "/applications/{id}/review-cutoff-override",
		Summary:       "Return an application to whatever the cutoff decides",
		Description:   "Chief only.",
		Tags:          []string{"Review ranking"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.deleteOverride)
}
