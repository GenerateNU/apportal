package meetingslot

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

const cycle, slot, app = accesstest.CycleID, accesstest.ItemID, accesstest.ApplicationID

type call func(context.Context, *meetingSlotService) error

func TestPermissions(t *testing.T) {
	cases := []struct {
		name string
		want accesstest.Want
		call call
	}{
		{"list", accesstest.Managers, func(ctx context.Context, s *meetingSlotService) error {
			_, err := s.list(ctx, &utils.CycleScopedInput{ID: cycle})
			return err
		}},
		{"create", accesstest.Managers, func(ctx context.Context, s *meetingSlotService) error {
			in := &CreateSlotInput{ID: cycle}
			in.Body.Label = "Tue 7pm"
			_, err := s.create(ctx, in)
			return err
		}},
		{"rename", accesstest.Managers, func(ctx context.Context, s *meetingSlotService) error {
			in := &RenameSlotInput{ID: cycle, SlotID: slot}
			in.Body.Label = "Wed 7pm"
			_, err := s.rename(ctx, in)
			return err
		}},
		{"delete", accesstest.Managers, func(ctx context.Context, s *meetingSlotService) error {
			_, err := s.remove(ctx, &SlotPathInput{ID: cycle, SlotID: slot})
			return err
		}},
		{"reorder", accesstest.Managers, func(ctx context.Context, s *meetingSlotService) error {
			in := &ReorderSlotsInput{ID: cycle}
			in.Body.SlotIDs = []string{slot}
			_, err := s.reorder(ctx, in)
			return err
		}},
		{"list staff slots", accesstest.Managers, func(ctx context.Context, s *meetingSlotService) error {
			_, err := s.listStaffSlots(ctx, &utils.CycleScopedInput{ID: cycle})
			return err
		}},
		{"set staff slot", accesstest.Managers, func(ctx context.Context, s *meetingSlotService) error {
			in := &SetStaffSlotInput{ID: cycle, NUID: "lead"}
			in.Body.SlotID = slot
			_, err := s.setStaffSlot(ctx, in)
			return err
		}},
		{"clear staff slot", accesstest.Managers, func(ctx context.Context, s *meetingSlotService) error {
			_, err := s.clearStaffSlot(ctx, &StaffSlotPathInput{ID: cycle, NUID: "lead"})
			return err
		}},
		{"match by slot", accesstest.Managers, func(ctx context.Context, s *meetingSlotService) error {
			in := &MatchBySlotInput{ID: cycle}
			in.Body.Enabled = true
			_, err := s.setMatchBySlot(ctx, in)
			return err
		}},
		{"get application slots", accesstest.OwnerOrStaff, func(ctx context.Context, s *meetingSlotService) error {
			_, err := s.applicationSlots(ctx, &utils.ApplicationScopedInput{ID: app})
			return err
		}},
		{"set application slots", accesstest.OwnerOnly, func(ctx context.Context, s *meetingSlotService) error {
			in := &SetApplicationSlotsInput{ID: app}
			in.Body.SlotIDs = []string{slot}
			_, err := s.setApplicationSlots(ctx, in)
			return err
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			accesstest.Run(t, c.want, func(ctx context.Context, gate access.Gate) error {
				return c.call(ctx, newService(gate, accesstest.DB(t)))
			})
		})
	}
}

func TestMalformedInput(t *testing.T) {
	admin := testutil.WithActor(*accesstest.Admin.Actor)
	s := newService(&accesstest.Recorder{Static: accesstest.Fixture()}, accesstest.DB(t))

	in := &SetStaffSlotInput{ID: cycle, NUID: "lead"}
	in.Body.SlotID = "tuesday"
	_, err := s.setStaffSlot(admin, in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	reorder := &ReorderSlotsInput{ID: cycle}
	reorder.Body.SlotIDs = []string{slot, slot}
	_, err = s.reorder(admin, reorder)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	mine := &SetApplicationSlotsInput{ID: app}
	mine.Body.SlotIDs = []string{"x"}
	_, err = s.setApplicationSlots(testutil.WithActor(*accesstest.Applicant.Actor), mine)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	create := &CreateSlotInput{ID: cycle}
	create.Body.Label = " "
	_, err = s.create(admin, create)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}
