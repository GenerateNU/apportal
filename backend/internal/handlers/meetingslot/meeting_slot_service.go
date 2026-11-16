package meetingslot

import (
	"context"
	"slices"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/staffgroup"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

var editableStages = []models.ApplicationStage{
	models.StageDraft, models.StageSubmitted, models.StageLeadReview, models.StageChiefReview, models.StageInterview,
}

type meetingSlotService struct {
	workflow *workflow.Service
	gate     access.Gate
	db       *gorm.DB
	slots    *MeetingSlotDB
}

func newService(gate access.Gate, db *gorm.DB) *meetingSlotService {
	return &meetingSlotService{workflow: workflow.NewService(db), gate: gate, db: db, slots: NewMeetingSlotDB(db)}
}

func (s *meetingSlotService) edit(ctx context.Context, cycleID string, ids ...string) error {
	if err := s.manage(ctx, cycleID, ids...); err != nil {
		return err
	}
	return s.workflow.RequireSetupEditable(ctx, cycleID, "", workflow.SetupInterviewLogistics)
}

func (s *meetingSlotService) manage(ctx context.Context, cycleID string, ids ...string) error {
	if err := utils.RequireUUIDs(append([]string{"cycle id", cycleID}, ids...)...); err != nil {
		return err
	}
	return s.gate.CanCycle(ctx, access.ManageCycle, cycleID)
}

func (s *meetingSlotService) list(ctx context.Context, in *utils.CycleScopedInput) (*SlotsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	rows, err := s.slots.List(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &SlotsOutput{Body: rows}, nil
}

func label(raw string) (string, error) {
	l := strings.TrimSpace(raw)
	if l == "" {
		return "", huma.Error422UnprocessableEntity("label is required")
	}
	return l, nil
}

func (s *meetingSlotService) create(ctx context.Context, in *CreateSlotInput) (*SlotOutput, error) {
	l, err := label(in.Body.Label)
	if err != nil {
		return nil, err
	}
	if err := s.edit(ctx, in.ID); err != nil {
		return nil, err
	}
	existing, err := s.slots.List(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if len(existing) >= maxSlots {
		return nil, huma.Error422UnprocessableEntity("a cycle can have at most 100 meeting slots")
	}
	row, err := s.slots.Create(ctx, in.ID, l)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &SlotOutput{Body: row}, nil
}

func (s *meetingSlotService) rename(ctx context.Context, in *RenameSlotInput) (*SlotOutput, error) {
	l, err := label(in.Body.Label)
	if err != nil {
		return nil, err
	}
	if err := s.edit(ctx, in.ID, "slot_id", in.SlotID); err != nil {
		return nil, err
	}
	row, err := s.slots.Rename(ctx, in.ID, in.SlotID, l)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &SlotOutput{Body: row}, nil
}

func (s *meetingSlotService) remove(ctx context.Context, in *SlotPathInput) (*struct{}, error) {
	if err := s.edit(ctx, in.ID, "slot_id", in.SlotID); err != nil {
		return nil, err
	}
	if err := s.slots.Delete(ctx, in.ID, in.SlotID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *meetingSlotService) reorder(ctx context.Context, in *ReorderSlotsInput) (*SlotsOutput, error) {
	ids, err := utils.UUIDList("slot_ids", in.Body.SlotIDs)
	if err != nil {
		return nil, err
	}
	if len(ids) != len(in.Body.SlotIDs) {
		return nil, huma.Error422UnprocessableEntity("slot_ids has duplicates")
	}
	if err := s.edit(ctx, in.ID); err != nil {
		return nil, err
	}
	ok, err := s.slots.Reorder(ctx, in.ID, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !ok {
		return nil, huma.Error422UnprocessableEntity("slot_ids must list every meeting slot in this cycle exactly once")
	}
	return s.list(ctx, &utils.CycleScopedInput{ID: in.ID})
}

func (s *meetingSlotService) listStaffSlots(ctx context.Context, in *utils.CycleScopedInput) (*StaffSlotsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	rows, err := s.slots.StaffSlots(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &StaffSlotsOutput{Body: rows}, nil
}

func (s *meetingSlotService) setStaffSlot(ctx context.Context, in *SetStaffSlotInput) (*StaffSlotOutput, error) {
	if err := s.edit(ctx, in.ID, "slot_id", in.Body.SlotID); err != nil {
		return nil, err
	}
	if err := staffgroup.RequireStaff(ctx, s.db, in.ID, []string{in.NUID}); err != nil {
		return nil, err
	}
	if err := s.requireSlots(ctx, in.ID, []string{in.Body.SlotID}); err != nil {
		return nil, err
	}
	row := models.StaffSlot{CycleID: in.ID, UserNUID: in.NUID, SlotID: in.Body.SlotID}
	if err := s.slots.SetStaffSlot(ctx, row); err != nil {
		return nil, utils.StoreErr(err)
	}
	return &StaffSlotOutput{Body: row}, nil
}

func (s *meetingSlotService) clearStaffSlot(ctx context.Context, in *StaffSlotPathInput) (*struct{}, error) {
	if err := s.edit(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := s.slots.ClearStaffSlot(ctx, in.ID, in.NUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *meetingSlotService) setMatchBySlot(ctx context.Context, in *MatchBySlotInput) (*MatchBySlotOutput, error) {
	if err := s.edit(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := s.slots.SetMatchBySlot(ctx, in.ID, in.Body.Enabled); err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &MatchBySlotOutput{}
	out.Body.MatchBySlot = in.Body.Enabled
	return out, nil
}

func (s *meetingSlotService) requireSlots(ctx context.Context, cycleID string, ids []string) error {
	ok, err := s.slots.InCycle(ctx, cycleID, ids)
	if err != nil {
		return utils.StoreErr(err)
	}
	if !ok {
		return huma.Error422UnprocessableEntity("slot ids must be meeting slots in this cycle")
	}
	return nil
}

func (s *meetingSlotService) applicationSlots(ctx context.Context, in *utils.ApplicationScopedInput) (*ApplicationSlotsOutput, error) {
	if err := utils.RequireUUIDs("application id", in.ID); err != nil {
		return nil, err
	}
	if err := s.gate.CanApplication(ctx, access.ViewApplication, in.ID); err != nil {
		return nil, err
	}
	return s.readApplicationSlots(ctx, in.ID)
}

func (s *meetingSlotService) readApplicationSlots(ctx context.Context, applicationID string) (*ApplicationSlotsOutput, error) {
	app, err := s.slots.Application(ctx, applicationID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	options, err := s.slots.List(ctx, app.CycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	chosen, err := s.slots.ApplicationSlotIDs(ctx, applicationID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicationSlotsOutput{Body: ApplicationSlots{
		Options: options, SlotIDs: chosen, Editable: slices.Contains(editableStages, app.Stage),
	}}, nil
}

func (s *meetingSlotService) setApplicationSlots(ctx context.Context, in *SetApplicationSlotsInput) (*ApplicationSlotsOutput, error) {
	if err := utils.RequireUUIDs("application id", in.ID); err != nil {
		return nil, err
	}
	ids, err := utils.UUIDList("slot_ids", in.Body.SlotIDs)
	if err != nil {
		return nil, err
	}
	if err := s.gate.CanApplication(ctx, access.EditOwnApplication, in.ID); err != nil {
		return nil, err
	}
	app, err := s.slots.Application(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !slices.Contains(editableStages, app.Stage) {
		return nil, huma.Error409Conflict("meeting times can't change once your interview is being scheduled")
	}
	if err := s.requireSlots(ctx, app.CycleID, ids); err != nil {
		return nil, err
	}
	if err := s.slots.SetApplicationSlots(ctx, in.ID, ids); err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.readApplicationSlots(ctx, in.ID)
}
