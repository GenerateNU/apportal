package cyclestaff

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB) {
	s := &cycleStaffService{staffDB: NewCycleStaffDB(db), access: access.NewChecker(db)}

	huma.Register(api, huma.Operation{
		OperationID: "list-my-cycles",
		Method:      http.MethodGet,
		Path:        "/users/me/cycles",
		Summary:     "List the cycles the current user is staff on, with their role",
		Tags:        []string{"Cycle staff"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.mine)

	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-staff",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/staff",
		Summary:     "List a cycle's leads and chiefs",
		Description: "Admins, or a chief who manages the cycle. Chiefs first, then by name.",
		Tags:        []string{"Cycle staff"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "set-cycle-staff",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/staff/{nuid}",
		Summary:     "Add someone to a cycle's staff, or change their role",
		Description: "Admin only. role is lead or chief; one role per person per cycle.",
		Tags:        []string{"Cycle staff"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.set)

	huma.Register(api, huma.Operation{
		OperationID:   "remove-cycle-staff",
		Method:        http.MethodDelete,
		Path:          "/cycles/{id}/staff/{nuid}",
		Summary:       "Remove someone from a cycle's staff",
		Description:   "Admin only.",
		Tags:          []string{"Cycle staff"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.remove)
}
