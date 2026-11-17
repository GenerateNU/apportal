package codesubmission

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func Route(api huma.API, db *gorm.DB) {
	codeSubmissionDB := NewCodeSubmissionDB(db)
	s := &codeSubmissionService{access: access.NewChecker(db), workflow: workflow.NewService(db), codeSubmissionDB: codeSubmissionDB}

	huma.Register(api, huma.Operation{
		OperationID: "upsert-code-submission",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/code-submission",
		Summary:     "Submit or update the challenge link",
		Description: "The applicant, while their application is a draft and applications are open. The challenge must belong to the application's cycle and role. Scores are populated externally.",
		Tags:        []string{"Code submissions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-code-submissions",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/code-submission",
		Summary:     "List an application's code submissions",
		Description: "Anyone who can view the application.",
		Tags:        []string{"Code submissions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.list)
}
