package applicant

import (
	"context"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type applicantService struct {
	access      *access.Checker
	applicantDB *ApplicantDB
}

func (s *applicantService) upsert(ctx context.Context, in *UpsertApplicantInput) (*ApplicantOutput, error) {
	email, ok := middleware.VerifiedEmailFrom(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("sign in first")
	}
	if !strings.EqualFold(strings.TrimSpace(in.Body.Email), email) {
		return nil, huma.Error403Forbidden("email must match your signed-in account")
	}
	if err := utils.RequireNortheasternEmail(email); err != nil {
		return nil, err
	}
	profile := ApplicantUpsert{
		NUID:           in.Body.NUID,
		Email:          email,
		FullName:       in.Body.FullName,
		GithubUsername: in.Body.GithubUsername,
		GraduationYear: in.Body.GraduationYear,
		Major:          in.Body.Major,
	}
	if actor, ok := middleware.ActorFrom(ctx); ok && actor.NUID != "" {
		if actor.NUID != in.Body.NUID {
			return nil, huma.Error403Forbidden("you can only update your own profile")
		}
		applicant, err := s.applicantDB.UpdateProfile(ctx, profile)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		return &ApplicantOutput{Body: applicant}, nil
	}
	applicant, created, err := s.applicantDB.CreateApplicant(ctx, profile)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !created {
		return nil, huma.Error409Conflict("that NUID is already registered")
	}
	return &ApplicantOutput{Body: applicant}, nil
}

func (s *applicantService) get(ctx context.Context, in *ApplicantNUIDInput) (*ApplicantOutput, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID != in.NUID {
		if err := s.access.RequireApplicant(ctx, in.NUID, access.Review); err != nil {
			return nil, err
		}
	}
	applicant, err := s.applicantDB.GetApplicant(ctx, in.NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicantOutput{Body: applicant}, nil
}
