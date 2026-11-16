package reviewranking

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
)

func Route(api huma.API, db *gorm.DB) {
	register(api, &rankingService{
		access: access.NewChecker(db),
		store:  NewRankingDB(db),
		roles:  role.NewRoleDB(db),
		rules:  NewPipelineRules(db),
	})
}

const locked = " Refused with 409 until the opening's reviews are in."

func register(api huma.API, s *rankingService) {
	tags := []string{"Review ranking"}
	openingErrors := []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity}
	writeErrors := append(openingErrors, http.StatusConflict)

	huma.Register(api, huma.Operation{
		OperationID: "get-review-ranking",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-ranking",
		Summary:     "Rank an opening's applications by normalized written-review score",
		Description: "Chiefs and admins. Scores are z-scored against each reviewer's own scores on each question, " +
			"so harsh and lenient reviewers count equally. Each entry is marked against the saved cutoff, then any hand-pick.",
		Tags:   tags,
		Errors: openingErrors,
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID: "put-review-cutoff",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/review-cutoff",
		Summary:     "Set an opening's review cutoff",
		Description: "Chiefs and admins. min_score keeps applications at or above a normalized score; " +
			"top_n keeps the N highest ranked plus anyone tied with the Nth." + locked,
		Tags:   tags,
		Errors: writeErrors,
	}, s.putCutoff)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-review-cutoff",
		Method:        http.MethodDelete,
		Path:          "/cycles/{id}/review-cutoff",
		Summary:       "Clear an opening's review cutoff",
		Description:   "Chiefs and admins." + locked,
		Tags:          tags,
		DefaultStatus: http.StatusNoContent,
		Errors:        writeErrors,
	}, s.deleteCutoff)

	huma.Register(api, huma.Operation{
		OperationID: "put-review-cutoff-override",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/review-cutoff-override",
		Summary:     "Hand-pick an application onto or off the shortlist",
		Description: "Chiefs and admins. Survives cutoff changes until cleared." + locked,
		Tags:        tags,
		Errors:      writeErrors,
	}, s.putOverride)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-review-cutoff-override",
		Method:        http.MethodDelete,
		Path:          "/applications/{id}/review-cutoff-override",
		Summary:       "Return an application to whatever the cutoff decides",
		Description:   "Chiefs and admins." + locked,
		Tags:          tags,
		DefaultStatus: http.StatusNoContent,
		Errors:        writeErrors,
	}, s.deleteOverride)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-review-cutoff-overrides",
		Method:        http.MethodDelete,
		Path:          "/cycles/{id}/review-cutoff-overrides",
		Summary:       "Clear every hand-pick for an opening",
		Description:   "Chiefs and admins." + locked,
		Tags:          tags,
		DefaultStatus: http.StatusNoContent,
		Errors:        writeErrors,
	}, s.deleteOverrides)

	huma.Register(api, huma.Operation{
		OperationID: "advance-shortlist",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/shortlist/advance",
		Summary:     "Move the shortlist on to interviews",
		Description: "Chiefs and admins. Moves shortlisted applications still in review to the interview stage, " +
			"or the next enabled stage when interviews are off, in one transaction." + locked,
		Tags:   tags,
		Errors: writeErrors,
	}, s.advance)
}
