package interviewgroup

import (
	"context"
	"errors"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type interviewGroupService struct {
	groupDB               *InterviewGroupDB
	applicationDB         *application.ApplicationDB
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
}

func toWrite(b GroupBody) (GroupWrite, error) {
	name := strings.TrimSpace(b.Name)
	if name == "" {
		return GroupWrite{}, huma.Error422UnprocessableEntity("name is required")
	}
	seen := make(map[string]bool, len(b.MemberNUIDs))
	members := make([]string, 0, len(b.MemberNUIDs))
	for _, nuid := range b.MemberNUIDs {
		if nuid = strings.TrimSpace(nuid); nuid != "" && !seen[nuid] {
			seen[nuid] = true
			members = append(members, nuid)
		}
	}
	return GroupWrite{Name: name, MeetingSlot: b.MeetingSlot, MemberNUIDs: members}, nil
}

func (s *interviewGroupService) list(ctx context.Context, in *utils.CycleScopedInput) (*GroupsOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	groups, err := s.groupDB.ListForCycle(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &GroupsOutput{Body: groups}, nil
}

func (s *interviewGroupService) create(ctx context.Context, in *CreateGroupInput) (*GroupOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	w, err := toWrite(in.Body)
	if err != nil {
		return nil, err
	}
	group, err := s.groupDB.Create(ctx, in.ID, utils.CurrentActor(ctx).NUID, w)
	if err != nil {
		return nil, groupErr(err)
	}
	return &GroupOutput{Body: group}, nil
}

func (s *interviewGroupService) update(ctx context.Context, in *UpdateGroupInput) (*GroupOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	w, err := toWrite(in.Body)
	if err != nil {
		return nil, err
	}
	group, err := s.groupDB.Update(ctx, in.ID, w)
	if err != nil {
		return nil, groupErr(err)
	}
	return &GroupOutput{Body: group}, nil
}

func (s *interviewGroupService) delete(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.groupDB.Delete(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *interviewGroupService) assign(ctx context.Context, in *AssignGroupInput) (*AssignGroupOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	app, err := s.applicationDB.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	group, err := s.groupDB.Get(ctx, in.GroupID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if group.CycleID != app.CycleID {
		return nil, huma.Error422UnprocessableEntity("the group belongs to a different cycle than the application")
	}

	pairs := make([]interviewassignment.AssignmentPair, len(group.Members))
	for n, m := range group.Members {
		pairs[n] = interviewassignment.AssignmentPair{ApplicationID: app.ID, LeadNUID: m.MemberNUID}
	}
	added, err := s.interviewAssignmentDB.CreateInterviewers(ctx, pairs, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	interviewers, err := s.interviewAssignmentDB.ListInterviewers(ctx, []string{app.ID})
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	out := &AssignGroupOutput{}
	out.Body.Added = added
	out.Body.Interviewers = interviewers
	return out, nil
}

func groupErr(err error) error {
	if errors.Is(err, utils.ErrConflict) {
		return huma.Error409Conflict("a group with that name already exists in this cycle")
	}
	return utils.StoreErr(err)
}
