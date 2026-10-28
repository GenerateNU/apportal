package applicant

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerChallengeScore(api huma.API, s *challengeScoreService) {
	huma.Register(api, huma.Operation{
		OperationID: "get-challenge-score",
		Method:      http.MethodGet,
		Path:        "/applicants/{nuid}/challenge-score",
		Summary:     "Get an applicant's technical challenge score",
		Description: "Reviewer only. Reads the applicant's best finished expedition from the separate challenge server, matched by their apportal email. Body is null if they have none there (e.g. they took the frontend challenge, or the lookup isn't configured).",
		Tags:        []string{"Applicants"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.get)
}
