package applicationtemplate

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type applicationTemplateService struct {
	applicationTemplateDB *ApplicationTemplateDB
	roleDB                *role.RoleDB
}

func (s *applicationTemplateService) listOpen(ctx context.Context, _ *ListOpenApplicationTemplatesInput) (*ApplicationTemplatesOutput, error) {
	templates, err := s.applicationTemplateDB.ListOpenApplicationTemplates(ctx)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicationTemplatesOutput{Body: templates}, nil
}

func (s *applicationTemplateService) get(ctx context.Context, in *GetApplicationTemplateInput) (*ApplicationTemplateOutput, error) {
	if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	t, err := s.applicationTemplateDB.GetOrCreateApplicationTemplate(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicationTemplateOutput{Body: t}, nil
}

func (s *applicationTemplateService) update(ctx context.Context, in *UpdateApplicationTemplateInput) (*ApplicationTemplateOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid status")
	}
	if in.Body.ReviewStatus != nil && !in.Body.ReviewStatus.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid review_status")
	}

	t, err := s.applicationTemplateDB.UpdateApplicationTemplate(ctx, in.ID, in.RoleID, ApplicationTemplateUpdate{
		Title:          in.Body.Title,
		Description:    in.Body.Description,
		Instructions:   in.Body.Instructions,
		OpensAt:        in.Body.OpensAt,
		ClosesAt:       in.Body.ClosesAt,
		Status:         in.Body.Status,
		ReviewStatus:   in.Body.ReviewStatus,
		ReviewClosesAt: in.Body.ReviewClosesAt,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicationTemplateOutput{Body: t}, nil
}
