package staffgroup

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

const cycle, group = accesstest.CycleID, accesstest.ItemID

func TestPermissions(t *testing.T) {
	cases := map[string]func(context.Context, *staffGroupService) error{
		"list": func(ctx context.Context, s *staffGroupService) error {
			_, err := s.list(ctx, &utils.CycleScopedInput{ID: cycle})
			return err
		},
		"create": func(ctx context.Context, s *staffGroupService) error {
			in := &CreateGroupInput{ID: cycle}
			in.Body.Name = "Design"
			_, err := s.create(ctx, in)
			return err
		},
		"rename": func(ctx context.Context, s *staffGroupService) error {
			in := &RenameGroupInput{ID: cycle, GroupID: group}
			in.Body.Name = "Eng"
			_, err := s.rename(ctx, in)
			return err
		},
		"delete": func(ctx context.Context, s *staffGroupService) error {
			_, err := s.remove(ctx, &GroupPathInput{ID: cycle, GroupID: group})
			return err
		},
		"add member": func(ctx context.Context, s *staffGroupService) error {
			_, err := s.addMember(ctx, &MemberPathInput{ID: cycle, GroupID: group, NUID: "lead"})
			return err
		},
		"remove member": func(ctx context.Context, s *staffGroupService) error {
			_, err := s.removeMember(ctx, &MemberPathInput{ID: cycle, GroupID: group, NUID: "lead"})
			return err
		},
		"list teams": func(ctx context.Context, s *staffGroupService) error {
			_, err := s.listTeams(ctx, &utils.CycleScopedInput{ID: cycle})
			return err
		},
		"set team": func(ctx context.Context, s *staffGroupService) error {
			in := &SetOpeningTeamInput{ID: cycle, RoleID: accesstest.RoleID, Kind: models.KindInterviewer}
			in.Body.GroupIDs = []string{group}
			_, err := s.setTeam(ctx, in)
			return err
		},
	}
	for name, call := range cases {
		t.Run(name, func(t *testing.T) {
			accesstest.Run(t, accesstest.Managers, func(ctx context.Context, gate access.Gate) error {
				return call(ctx, newService(gate, accesstest.DB(t)))
			})
		})
	}
}

func TestMalformedIDs(t *testing.T) {
	ctx := testutil.WithActor(*accesstest.Admin.Actor)
	s := newService(&accesstest.Recorder{Static: accesstest.Fixture()}, accesstest.DB(t))

	_, err := s.list(ctx, &utils.CycleScopedInput{ID: "nope"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	_, err = s.remove(ctx, &GroupPathInput{ID: cycle, GroupID: "nope"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	in := &SetOpeningTeamInput{ID: cycle, RoleID: accesstest.RoleID, Kind: models.KindInterviewer}
	in.Body.GroupIDs = []string{"nope"}
	_, err = s.setTeam(ctx, in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	in.Kind = "planner"
	_, err = s.setTeam(ctx, in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestCreateRejectsBlankName(t *testing.T) {
	ctx := testutil.WithActor(*accesstest.Admin.Actor)
	s := newService(&accesstest.Recorder{Static: accesstest.Fixture()}, accesstest.DB(t))
	in := &CreateGroupInput{ID: cycle}
	in.Body.Name = "  "
	_, err := s.create(ctx, in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}
