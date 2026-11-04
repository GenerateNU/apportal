package challenge

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	challengeDB := NewChallengeDB(db)
	s := &challengeService{challengeDB: challengeDB}

	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-challenges",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/challenges",
		Summary:     "List a cycle's code challenges",
		Tags:        []string{"Code challenges"},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-challenge",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/challenges",
		Summary:       "Create a code challenge",
		Description:   "Chief only.",
		Tags:          []string{"Code challenges"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.create)
}
