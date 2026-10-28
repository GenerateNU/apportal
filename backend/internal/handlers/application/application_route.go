package application

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/applicationtemplate"
	"github.com/GenerateNU/apportal/backend/internal/handlers/challenge"
	"github.com/GenerateNU/apportal/backend/internal/handlers/codesubmission"
	"github.com/GenerateNU/apportal/backend/internal/handlers/question"
	"github.com/GenerateNU/apportal/backend/internal/storage"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB, storageClient *storage.Client) {
	applicationDB := NewApplicationDB(db)
	applicationTemplateDB := applicationtemplate.NewApplicationTemplateDB(db)
	challengeDB := challenge.NewChallengeDB(db)
	codeSubmissionDB := codesubmission.NewCodeSubmissionDB(db)
	questionDB := question.NewQuestionDB(db)

	registerAnswer(api, &answerService{applicationDB: applicationDB})
	registerApplication(api, &applicationService{applicationDB: applicationDB, applicationTemplateDB: applicationTemplateDB, challengeDB: challengeDB, codeSubmissionDB: codeSubmissionDB, questionDB: questionDB})
	registerUpload(api, &uploadService{applicationDB: applicationDB, questionDB: questionDB, storage: storageClient})
}

func registerApplication(api huma.API, s *applicationService) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-application",
		Method:        http.MethodPost,
		Path:          "/applications",
		Summary:       "Submit an application",
		Description:   "One application per applicant, role, and cycle.",
		Tags:          []string{"Applications"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusConflict, http.StatusForbidden},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "get-application",
		Method:      http.MethodGet,
		Path:        "/applications/{id}",
		Summary:     "Get an application",
		Tags:        []string{"Applications"},
		Errors:      []int{http.StatusNotFound},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID: "list-applications",
		Method:      http.MethodGet,
		Path:        "/applications",
		Summary:     "List applications",
		Description: "Reviewer queue; filter by cycle_id, role/roles, stage, answer_filters, and rating_filters. Applicants may list their own by passing user_nuid.",
		Tags:        []string{"Applications"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "update-application",
		Method:      http.MethodPatch,
		Path:        "/applications/{id}",
		Summary:     "Update an application",
		Description: "Set resume_url, availability, or advance/withdraw the stage.",
		Tags:        []string{"Applications"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-application",
		Method:        http.MethodDelete,
		Path:          "/applications/{id}",
		Summary:       "Discard a draft application",
		Description:   "Applicant only, and only while still a draft.",
		Tags:          []string{"Applications"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusNotFound},
	}, s.delete)
}
