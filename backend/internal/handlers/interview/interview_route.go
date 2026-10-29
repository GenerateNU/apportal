package interview

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	applicationDB := application.NewApplicationDB(db)
	interviewAssignmentDB := interviewassignment.NewInterviewAssignmentDB(db)
	interviewDB := NewInterviewDB(db)

	registerInterviewComment(api, &interviewCommentService{interviewDB: interviewDB})
	registerInterviewScript(api, &interviewScriptService{interviewDB: interviewDB})
	registerInterview(api, &interviewService{applicationDB: applicationDB, interviewDB: interviewDB, interviewAssignmentDB: interviewAssignmentDB})
}

func registerInterview(api huma.API, s *interviewService) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-interview",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/interview",
		Summary:     "Create or update the interview write-up",
		Description: "Reviewer only (the interviewer). Provided fields overwrite; omitted ones are preserved.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "get-interview",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview",
		Summary:     "Get an application's interview",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID: "list-interviews-bulk",
		Method:      http.MethodGet,
		Path:        "/interviews",
		Summary:     "List interviews for several applications",
		Description: "Reviewer only. One request for a page of applications, instead of one per application.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.listBulk)
}
