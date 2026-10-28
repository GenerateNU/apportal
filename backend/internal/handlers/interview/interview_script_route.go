package interview

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerInterviewScript(api huma.API, s *interviewScriptService) {
	huma.Register(api, huma.Operation{
		OperationID: "get-interview-script",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/interview-script",
		Summary:     "Get a cycle's per-role interview script",
		Description: "Reviewer only. ?role= selects which role's script to fetch (required). Creates a default-content row on first access.",
		Tags:        []string{"Interview script"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID: "update-interview-script",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/interview-script",
		Summary:     "Replace a cycle's per-role interview script",
		Description: "Chief only. ?role= selects which role's script to update (required). Replaces the whole script — there's no partial update.",
		Tags:        []string{"Interview script"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity, http.StatusNotFound},
	}, s.update)
}
