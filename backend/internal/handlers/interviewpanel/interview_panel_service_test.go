package interviewpanel

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

const cycle, panel = accesstest.CycleID, accesstest.ItemID

func TestPermissions(t *testing.T) {
	cases := map[string]func(context.Context, *interviewPanelService) error{
		"list": func(ctx context.Context, s *interviewPanelService) error {
			_, err := s.list(ctx, &utils.CycleScopedInput{ID: cycle})
			return err
		},
		"create": func(ctx context.Context, s *interviewPanelService) error {
			in := &CreatePanelInput{ID: cycle}
			in.Body.Name = "Panel A"
			_, err := s.create(ctx, in)
			return err
		},
		"auto": func(ctx context.Context, s *interviewPanelService) error {
			in := &AutoPanelsInput{ID: cycle}
			in.Body.Size = 2
			_, err := s.auto(ctx, in)
			return err
		},
		"rename": func(ctx context.Context, s *interviewPanelService) error {
			in := &RenamePanelInput{ID: cycle, PanelID: panel}
			in.Body.Name = "Panel B"
			_, err := s.rename(ctx, in)
			return err
		},
		"delete": func(ctx context.Context, s *interviewPanelService) error {
			_, err := s.remove(ctx, &PanelPathInput{ID: cycle, PanelID: panel})
			return err
		},
		"add member": func(ctx context.Context, s *interviewPanelService) error {
			_, err := s.addMember(ctx, &MemberPathInput{ID: cycle, PanelID: panel, NUID: "lead"})
			return err
		},
		"remove member": func(ctx context.Context, s *interviewPanelService) error {
			_, err := s.removeMember(ctx, &MemberPathInput{ID: cycle, PanelID: panel, NUID: "lead"})
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

func TestBadInput(t *testing.T) {
	ctx := testutil.WithActor(*accesstest.Admin.Actor)
	s := newService(&accesstest.Recorder{Static: accesstest.Fixture()}, accesstest.DB(t))

	_, err := s.remove(ctx, &PanelPathInput{ID: cycle, PanelID: "p1"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	for _, size := range []int{0, maxMembers + 1} {
		in := &AutoPanelsInput{ID: cycle}
		in.Body.Size = size
		_, err = s.auto(ctx, in)
		testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	}

	in := &AutoPanelsInput{ID: cycle}
	in.Body.Size, in.Body.RoleID = 2, "eng"
	_, err = s.auto(ctx, in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	create := &CreatePanelInput{ID: cycle}
	create.Body.Name = ""
	_, err = s.create(ctx, create)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestOnAnotherPanelIsConflict(t *testing.T) {
	testutil.WantStatus(t, storeErr(errOnAnotherPanel), http.StatusConflict)
}
