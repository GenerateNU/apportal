package applicant

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB, challenge *ChallengeClient) {
	applicantDB := NewApplicantDB(db)

	registerApplicant(api, &applicantService{applicantDB: applicantDB})
	registerChallengeScore(api, &challengeScoreService{applicantDB: applicantDB, challenge: challenge})
}

func registerApplicant(api huma.API, s *applicantService) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-applicant",
		Method:      http.MethodPost,
		Path:        "/applicants",
		Summary:     "Create or update an applicant",
		Description: "Applicant-facing; upserts by NUID.",
		Tags:        []string{"Applicants"},
		Errors:      []int{http.StatusConflict},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "get-applicant",
		Method:      http.MethodGet,
		Path:        "/applicants/{nuid}",
		Summary:     "Get an applicant",
		Tags:        []string{"Applicants"},
		Errors:      []int{http.StatusNotFound},
	}, s.get)
}
