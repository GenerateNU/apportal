package applicant

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB, challenge *ChallengeClient) {
	applicantDB := NewApplicantDB(db)

	registerApplicant(api, &applicantService{access: access.NewChecker(db), applicantDB: applicantDB})
	registerChallengeScore(api, &challengeScoreService{access: access.NewChecker(db), applicantDB: applicantDB, challenge: challenge})
}

func registerApplicant(api huma.API, s *applicantService) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-applicant",
		Method:      http.MethodPost,
		Path:        "/applicants",
		Summary:     "Create or update your profile",
		Description: "Needs a verified session whose email matches the body. Creates your users row the first time; after that only updates your own profile, never email or roles. An NUID already registered is a conflict.",
		Tags:        []string{"Applicants"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "get-applicant",
		Method:      http.MethodGet,
		Path:        "/applicants/{nuid}",
		Summary:     "Get an applicant",
		Description: "Yourself, or staff who can see one of their applications.",
		Tags:        []string{"Applicants"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.get)
}
