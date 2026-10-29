package cycle

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerCycleStage(api huma.API, s *cycleStageService) {
	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-stages",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/stages",
		Summary:     "List a cycle's flow-template stages",
		Tags:        []string{"Cycle stages"},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-cycle-stage",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/stages",
		Summary:       "Add a stage to a cycle's flow template",
		Description:   "Chief only.",
		Tags:          []string{"Cycle stages"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-cycle-stage",
		Method:      http.MethodPatch,
		Path:        "/cycle-stages/{id}",
		Summary:     "Update a cycle stage",
		Description: "Chief only.",
		Tags:        []string{"Cycle stages"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.update)
}
