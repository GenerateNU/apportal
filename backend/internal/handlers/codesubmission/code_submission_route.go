package codesubmission

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	codeSubmissionDB := NewCodeSubmissionDB(db)
	s := &codeSubmissionService{codeSubmissionDB: codeSubmissionDB}

	huma.Register(api, huma.Operation{
		OperationID: "upsert-code-submission",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/code-submission",
		Summary:     "Submit or update the challenge link",
		Description: "Records the submission URL. Scores are populated externally (deferred).",
		Tags:        []string{"Code submissions"},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-code-submissions",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/code-submission",
		Summary:     "List an application's code submissions",
		Tags:        []string{"Code submissions"},
	}, s.list)
}
