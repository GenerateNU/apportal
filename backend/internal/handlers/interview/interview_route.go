package interview

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB) {
	applicationDB := application.NewApplicationDB(db)
	interviewAssignmentDB := interviewassignment.NewInterviewAssignmentDB(db)
	interviewDB := NewInterviewDB(db)

	registerInterviewScript(api, &interviewScriptService{workflow: workflow.NewService(db), access: access.NewChecker(db), interviewDB: interviewDB, roleDB: role.NewRoleDB(db)})
	registerInterview(api, &interviewService{access: access.NewChecker(db), applicationDB: applicationDB, interviewDB: interviewDB, interviewAssignmentDB: interviewAssignmentDB, workflow: workflow.NewService(db)})
}

func registerInterview(api huma.API, s *interviewService) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-interview",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/interview",
		Summary:     "Update the interview and your write-up",
		Description: "Assigned interviewers only. Updates the shared interview fields and your own write-up; omitted fields are preserved.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
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
