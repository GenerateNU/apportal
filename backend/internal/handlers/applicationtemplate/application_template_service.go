package applicationtemplate

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type applicationTemplateService struct {
	access                *access.Checker
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
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if err := s.access.RequireForm(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	t, err := s.applicationTemplateDB.GetOrCreateApplicationTemplate(ctx, in.ID, in.RoleID)
	if err == nil {
		err = s.applicationTemplateDB.FillTimeline(ctx, &t)
	}
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicationTemplateOutput{Body: t}, nil
}

func (s *applicationTemplateService) update(ctx context.Context, in *UpdateApplicationTemplateInput) (*ApplicationTemplateOutput, error) {
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid status")
	}
	if in.Body.ReviewStatus != nil && !in.Body.ReviewStatus.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid review_status")
	}
	if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	if _, err := s.applicationTemplateDB.GetOrCreateApplicationTemplate(ctx, in.ID, in.RoleID); err != nil {
		return nil, utils.StoreErr(err)
	}

	actor := utils.CurrentActor(ctx)
	if err := s.applicationTemplateDB.ApplyTimeline(ctx, in.ID, in.RoleID, pipeline.TemplateTimeline{
		ClosesAt:       in.Body.ClosesAt,
		Status:         in.Body.Status,
		ReviewClosesAt: in.Body.ReviewClosesAt,
		ReviewStatus:   in.Body.ReviewStatus,
	}, pipeline.Actor{NUID: actor.NUID, Admin: access.IsAdmin(actor)}); err != nil {
		return nil, pipeline.HTTPErr(err)
	}

	t, err := s.applicationTemplateDB.UpdateApplicationTemplate(ctx, in.ID, in.RoleID, ApplicationTemplateUpdate{
		Title:        in.Body.Title,
		Description:  in.Body.Description,
		Instructions: in.Body.Instructions,
	})
	if err == nil {
		err = s.applicationTemplateDB.FillTimeline(ctx, &t)
	}
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicationTemplateOutput{Body: t}, nil
}
