package applicant

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type applicantService struct {
	applicantDB *ApplicantDB
}

func (s *applicantService) upsert(ctx context.Context, in *UpsertApplicantInput) (*ApplicantOutput, error) {
	if err := utils.RequireNortheasternEmail(in.Body.Email); err != nil {
		return nil, err
	}
	applicant, err := s.applicantDB.UpsertApplicant(ctx, ApplicantUpsert{
		NUID:           in.Body.NUID,
		Email:          in.Body.Email,
		FullName:       in.Body.FullName,
		GithubUsername: in.Body.GithubUsername,
		GraduationYear: in.Body.GraduationYear,
		Major:          in.Body.Major,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicantOutput{Body: applicant}, nil
}

func (s *applicantService) get(ctx context.Context, in *ApplicantNUIDInput) (*ApplicantOutput, error) {
	applicant, err := s.applicantDB.GetApplicant(ctx, in.NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicantOutput{Body: applicant}, nil
}
