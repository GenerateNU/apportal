package applicant

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type challengeScoreService struct {
	applicantDB *ApplicantDB
	challenge   *ChallengeClient
}

func (s *challengeScoreService) get(ctx context.Context, in *ApplicantNUIDInput) (*ChallengeScoreOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	// The challenge server's lookup endpoint only accepts id/email, not
	// NUID — resolve the applicant's email from apportal's own record first.
	applicant, err := s.applicantDB.GetApplicant(ctx, in.NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	score, err := s.challenge.GetChallengeScore(ctx, applicant.Email)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChallengeScoreOutput{Body: score}, nil
}
