package cycle

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
)

func Route(api huma.API, db *gorm.DB) {
	cycleDB := NewCycleDB(db)

	registerCycle(api, &cycleService{cycleDB: cycleDB, roleDB: role.NewRoleDB(db)})
	registerCycleStage(api, &cycleStageService{cycleDB: cycleDB})
}

func registerCycle(api huma.API, s *cycleService) {
	huma.Register(api, huma.Operation{
		OperationID: "list-cycles",
		Method:      http.MethodGet,
		Path:        "/cycles",
		Summary:     "List cycles",
		Description: "Optional ?status= filters to one status (draft, open, closed, archived); ?branch_id= to one branch.",
		Tags:        []string{"Cycles"},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "get-cycle",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}",
		Summary:     "Get a cycle",
		Tags:        []string{"Cycles"},
		Errors:      []int{http.StatusNotFound},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID: "cycle-template-summary",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/template-summary",
		Summary:     "Per-role template counts for a cycle",
		Description: "One entry per role of the cycle: question count (role-specific plus global), code challenge count, and submitted application count — computed via COUNT queries instead of requiring the full row sets.",
		Tags:        []string{"Cycles"},
	}, s.templateSummary)

	huma.Register(api, huma.Operation{
		OperationID:   "create-cycle",
		Method:        http.MethodPost,
		Path:          "/cycles",
		Summary:       "Create a cycle",
		Description:   "Chief only. Starts with a copy of the roles of the branch's latest cycle of the same application type.",
		Tags:          []string{"Cycles"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-cycle",
		Method:      http.MethodPatch,
		Path:        "/cycles/{id}",
		Summary:     "Update a cycle",
		Description: "Chief only.",
		Tags:        []string{"Cycles"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.update)
}
