package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type challengeScoreHandler struct {
	store *store.Store
}

func (h *challengeScoreHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-challenge-score",
		Method:      http.MethodGet,
		Path:        "/applicants/{nuid}/challenge-score",
		Summary:     "Get an applicant's technical challenge score",
		Description: "Reviewer only. Reads the applicant's best finished expedition from the separate challenge server, matched by their apportal email. Body is null if they have none there (e.g. they took the frontend challenge, or the lookup isn't configured).",
		Tags:        []string{"Applicants"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.get)
}

type ChallengeScoreOutput struct {
	Body *models.ChallengeScore
}

func (h *challengeScoreHandler) get(ctx context.Context, in *ApplicantNUIDInput) (*ChallengeScoreOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	// The challenge server's lookup endpoint only accepts id/email, not
	// NUID — resolve the applicant's email from apportal's own record first.
	applicant, err := h.store.GetApplicant(ctx, in.NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	score, err := h.store.GetChallengeScore(ctx, applicant.Email)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ChallengeScoreOutput{Body: score}, nil
}
