package application

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerAnswer(api huma.API, s *answerService) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-answers",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/answers",
		Summary:     "Submit or update written answers",
		Description: "Bulk upsert keyed on (application, question). Owner-only, and only while the application is still a draft.",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-answers",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/answers",
		Summary:     "List an application's written answers",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusNotFound},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "list-answers-bulk",
		Method:      http.MethodGet,
		Path:        "/answers",
		Summary:     "List written answers for several applications",
		Description: "One request for a page of applications, instead of one per application. Reviewer-only; draft answers are never included.",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.listBulk)
}
