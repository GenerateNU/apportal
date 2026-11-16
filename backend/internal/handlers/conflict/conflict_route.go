package conflict

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
)

func Route(api huma.API, db *gorm.DB) {
	register(api, &service{gate: access.NewChecker(db), store: staffing.NewConflictStore(db)})
}

func register(api huma.API, s *service) {
	errs := []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity}
	tags := []string{"Assignment planning"}

	huma.Register(api, huma.Operation{
		OperationID: "list-review-conflicts",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-conflicts",
		Summary:     "Staff who must not review or interview an applicant",
		Description: "Chief only. Applies to every opening on the cycle, for reviews and interviews.",
		Tags:        tags,
		Errors:      errs,
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "add-review-conflict",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/review-conflicts/{lead_nuid}/{applicant_nuid}",
		Summary:     "Keep a staff member away from an applicant",
		Description: "Chief only. Idempotent. The lead must be on the cycle's staff and the applicant must have applied. Returns the updated list.",
		Tags:        tags,
		Errors:      errs,
	}, s.add)

	huma.Register(api, huma.Operation{
		OperationID: "remove-review-conflict",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/review-conflicts/{lead_nuid}/{applicant_nuid}",
		Summary:     "Remove a conflict",
		Description: "Chief only. Idempotent. Returns the updated list.",
		Tags:        tags,
		Errors:      errs,
	}, s.remove)
}
