package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type applicantHandler struct {
	store *store.Store
}

func (h *applicantHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-applicant",
		Method:      http.MethodPost,
		Path:        "/applicants",
		Summary:     "Create or update an applicant",
		Description: "Applicant-facing; upserts by NUID.",
		Tags:        []string{"Applicants"},
		Errors:      []int{http.StatusConflict},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "get-applicant",
		Method:      http.MethodGet,
		Path:        "/applicants/{nuid}",
		Summary:     "Get an applicant",
		Tags:        []string{"Applicants"},
		Errors:      []int{http.StatusNotFound},
	}, h.get)
}

type ApplicantOutput struct {
	Body models.Applicant
}

type UpsertApplicantInput struct {
	Body struct {
		NUID           string  `json:"nuid" minLength:"1"`
		Email          string  `json:"email" format:"email"`
		FullName       string  `json:"full_name" minLength:"1"`
		GithubUsername *string `json:"github_username,omitempty"`
		GraduationYear *int    `json:"graduation_year,omitempty"`
		Major          *string `json:"major,omitempty"`
	}
}

func (h *applicantHandler) upsert(ctx context.Context, in *UpsertApplicantInput) (*ApplicantOutput, error) {
	applicant, err := h.store.UpsertApplicant(ctx, store.ApplicantUpsert{
		NUID:           in.Body.NUID,
		Email:          in.Body.Email,
		FullName:       in.Body.FullName,
		GithubUsername: in.Body.GithubUsername,
		GraduationYear: in.Body.GraduationYear,
		Major:          in.Body.Major,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &ApplicantOutput{Body: applicant}, nil
}

type ApplicantNUIDInput struct {
	NUID string `path:"nuid"`
}

func (h *applicantHandler) get(ctx context.Context, in *ApplicantNUIDInput) (*ApplicantOutput, error) {
	applicant, err := h.store.GetApplicant(ctx, in.NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ApplicantOutput{Body: applicant}, nil
}
