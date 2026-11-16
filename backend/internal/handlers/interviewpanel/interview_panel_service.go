package interviewpanel

import (
	"context"
	"errors"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/handlers/staffgroup"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type interviewPanelService struct {
	workflow *workflow.Service
	gate     access.Gate
	db       *gorm.DB
	panels   *InterviewPanelDB
	roleDB   *role.RoleDB
}

func newService(gate access.Gate, db *gorm.DB) *interviewPanelService {
	return &interviewPanelService{workflow: workflow.NewService(db), gate: gate, db: db, panels: NewInterviewPanelDB(db), roleDB: role.NewRoleDB(db)}
}

func (s *interviewPanelService) edit(ctx context.Context, cycleID string, ids ...string) error {
	if err := s.manage(ctx, cycleID, ids...); err != nil {
		return err
	}
	return s.workflow.RequireSetupEditable(ctx, cycleID, "", workflow.SetupInterviewLogistics)
}

func (s *interviewPanelService) manage(ctx context.Context, cycleID string, ids ...string) error {
	if err := utils.RequireUUIDs(append([]string{"cycle id", cycleID}, ids...)...); err != nil {
		return err
	}
	return s.gate.CanCycle(ctx, access.ManageCycle, cycleID)
}

func storeErr(err error) error {
	if errors.Is(err, errOnAnotherPanel) {
		return huma.Error409Conflict("someone here is already on another panel this cycle")
	}
	return utils.StoreErr(err)
}

func name(raw string) (string, error) {
	n := strings.TrimSpace(raw)
	if n == "" {
		return "", huma.Error422UnprocessableEntity("name is required")
	}
	return n, nil
}

func (s *interviewPanelService) list(ctx context.Context, in *utils.CycleScopedInput) (*PanelsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	panels, err := s.panels.List(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PanelsOutput{Body: panels}, nil
}

func (s *interviewPanelService) get(ctx context.Context, cycleID, panelID string) (*PanelOutput, error) {
	p, err := s.panels.Get(ctx, cycleID, panelID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PanelOutput{Body: p}, nil
}

func (s *interviewPanelService) create(ctx context.Context, in *CreatePanelInput) (*PanelOutput, error) {
	n, err := name(in.Body.Name)
	if err != nil {
		return nil, err
	}
	if err := s.edit(ctx, in.ID); err != nil {
		return nil, err
	}
	nuids := utils.NUIDList(in.Body.MemberNUIDs)
	if len(nuids) > maxMembers {
		return nil, huma.Error422UnprocessableEntity("too many members")
	}
	if err := staffgroup.RequireStaff(ctx, s.db, in.ID, nuids); err != nil {
		return nil, err
	}
	id, err := s.panels.Create(ctx, in.ID, n, utils.CurrentActor(ctx).NUID, nuids)
	if err != nil {
		return nil, storeErr(err)
	}
	return s.get(ctx, in.ID, id)
}

func (s *interviewPanelService) rename(ctx context.Context, in *RenamePanelInput) (*PanelOutput, error) {
	n, err := name(in.Body.Name)
	if err != nil {
		return nil, err
	}
	if err := s.edit(ctx, in.ID, "panel_id", in.PanelID); err != nil {
		return nil, err
	}
	if err := s.panels.Rename(ctx, in.ID, in.PanelID, n); err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.get(ctx, in.ID, in.PanelID)
}

func (s *interviewPanelService) remove(ctx context.Context, in *PanelPathInput) (*struct{}, error) {
	if err := s.edit(ctx, in.ID, "panel_id", in.PanelID); err != nil {
		return nil, err
	}
	if err := s.panels.Delete(ctx, in.ID, in.PanelID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *interviewPanelService) addMember(ctx context.Context, in *MemberPathInput) (*PanelOutput, error) {
	if err := s.edit(ctx, in.ID, "panel_id", in.PanelID); err != nil {
		return nil, err
	}
	if err := staffgroup.RequireStaff(ctx, s.db, in.ID, []string{in.NUID}); err != nil {
		return nil, err
	}
	if err := s.panels.AddMember(ctx, in.ID, in.PanelID, in.NUID); err != nil {
		return nil, storeErr(err)
	}
	return s.get(ctx, in.ID, in.PanelID)
}

func (s *interviewPanelService) removeMember(ctx context.Context, in *MemberPathInput) (*struct{}, error) {
	if err := s.edit(ctx, in.ID, "panel_id", in.PanelID); err != nil {
		return nil, err
	}
	if err := s.panels.RemoveMember(ctx, in.ID, in.PanelID, in.NUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *interviewPanelService) auto(ctx context.Context, in *AutoPanelsInput) (*PanelsOutput, error) {
	if in.Body.Size < 1 || in.Body.Size > maxMembers {
		return nil, huma.Error422UnprocessableEntity("size must be between 1 and 20")
	}
	if in.Body.RoleID != "" {
		if err := role.ParseRoleID(in.Body.RoleID); err != nil {
			return nil, err
		}
	}
	if err := s.edit(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.RoleID != "" {
		if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.Body.RoleID); err != nil {
			return nil, err
		}
	}
	ids, err := s.panels.AutoCreate(ctx, in.ID, in.Body.RoleID, utils.CurrentActor(ctx).NUID, in.Body.Size)
	if err != nil {
		return nil, storeErr(err)
	}
	all, err := s.panels.List(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := []models.InterviewPanelDetail{}
	for _, p := range all {
		for _, id := range ids {
			if p.ID == id {
				out = append(out, p)
			}
		}
	}
	return &PanelsOutput{Body: out}, nil
}
