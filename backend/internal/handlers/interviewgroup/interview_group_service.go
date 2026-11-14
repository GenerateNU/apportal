package interviewgroup

import (
	"context"
	"errors"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type interviewGroupService struct {
	groupDB               *InterviewGroupDB
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

func (s *interviewGroupService) createMany(ctx context.Context, in *CreateGroupsInput) (*GroupsOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	writes := make([]GroupWrite, len(in.Body.Groups))
	for n, b := range in.Body.Groups {
		w, err := toWrite(b)
		if err != nil {
			return nil, err
		}
		writes[n] = w
	}
	groups, err := s.groupDB.CreateMany(ctx, in.ID, utils.CurrentActor(ctx).NUID, writes)
	if err != nil {
		return nil, groupErr(err)
	}
	return &GroupsOutput{Body: groups}, nil
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
	seen := map[string]bool{}
	ids := make([]string, 0, len(in.Body.ApplicationIDs))
	for _, id := range in.Body.ApplicationIDs {
		if _, err := uuid.Parse(id); err != nil {
			return nil, huma.Error422UnprocessableEntity("application_ids must be UUIDs")
		}
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}

	group, err := s.groupDB.Get(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if len(group.Members) == 0 {
		return nil, huma.Error422UnprocessableEntity("the group has no members")
	}
	found, err := s.groupDB.CountApplicationsInCycle(ctx, group.CycleID, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if int(found) != len(ids) {
		return nil, huma.Error422UnprocessableEntity("every application must exist and belong to the group's cycle")
	}

	taken, err := s.groupDB.ApplicantsWithInterviewers(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if len(taken) > 0 {
		return nil, huma.Error409Conflict("already has interviewers: " + strings.Join(taken, ", "))
	}

	pairs := make([]interviewassignment.AssignmentPair, 0, len(ids)*len(group.Members))
	for _, id := range ids {
		for _, m := range group.Members {
			pairs = append(pairs, interviewassignment.AssignmentPair{ApplicationID: id, LeadNUID: m.MemberNUID})
		}
	}
	added, err := s.interviewAssignmentDB.CreateInterviewers(ctx, pairs, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	interviewers, err := s.interviewAssignmentDB.ListInterviewers(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	out := &AssignGroupOutput{}
	out.Body.Added = added
	out.Body.Interviewers = interviewers
	return out, nil
}

func groupErr(err error) error {
	var invalid *InvalidMembersError
	if errors.As(err, &invalid) {
		return huma.Error422UnprocessableEntity(invalid.Error())
	}
	if errors.Is(err, utils.ErrConflict) {
		return huma.Error409Conflict("a group with that name already exists in this cycle")
	}
	return utils.StoreErr(err)
}
