package staffgroup

import (
	"context"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type staffGroupService struct {
	gate   access.Gate
	db     *gorm.DB
	groups *StaffGroupDB
	roleDB *role.RoleDB
}

func newService(gate access.Gate, db *gorm.DB) *staffGroupService {
	return &staffGroupService{gate: gate, db: db, groups: NewStaffGroupDB(db), roleDB: role.NewRoleDB(db)}
}

func (s *staffGroupService) manage(ctx context.Context, cycleID string, ids ...string) error {
	if err := utils.RequireUUIDs(append([]string{"cycle id", cycleID}, ids...)...); err != nil {
		return err
	}
	return s.gate.CanCycle(ctx, access.ManageCycle, cycleID)
}

// RequireStaff 422s unless every nuid is on the cycle's staff.
func RequireStaff(ctx context.Context, db *gorm.DB, cycleID string, nuids []string) error {
	missing, err := staffing.NotStaff(db.WithContext(ctx), cycleID, nuids)
	if err != nil {
		return utils.StoreErr(err)
	}
	if len(missing) > 0 {
		return huma.Error422UnprocessableEntity("not on this cycle's staff: " + strings.Join(missing, ", "))
	}
	return nil
}

func (s *staffGroupService) list(ctx context.Context, in *utils.CycleScopedInput) (*GroupsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	groups, err := s.groups.List(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &GroupsOutput{Body: groups}, nil
}

func (s *staffGroupService) create(ctx context.Context, in *CreateGroupInput) (*GroupOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Body.Name)
	if name == "" {
		return nil, huma.Error422UnprocessableEntity("name is required")
	}
	nuids := utils.NUIDList(in.Body.MemberNUIDs)
	if len(nuids) > maxMembers {
		return nil, huma.Error422UnprocessableEntity("too many members")
	}
	if err := RequireStaff(ctx, s.db, in.ID, nuids); err != nil {
		return nil, err
	}
	id, err := s.groups.Create(ctx, in.ID, name, nuids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.get(ctx, in.ID, id)
}

func (s *staffGroupService) get(ctx context.Context, cycleID, groupID string) (*GroupOutput, error) {
	g, err := s.groups.Get(ctx, cycleID, groupID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &GroupOutput{Body: g}, nil
}

func (s *staffGroupService) rename(ctx context.Context, in *RenameGroupInput) (*GroupOutput, error) {
	if err := s.manage(ctx, in.ID, "group_id", in.GroupID); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Body.Name)
	if name == "" {
		return nil, huma.Error422UnprocessableEntity("name is required")
	}
	if err := s.groups.Rename(ctx, in.ID, in.GroupID, name); err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.get(ctx, in.ID, in.GroupID)
}

func (s *staffGroupService) remove(ctx context.Context, in *GroupPathInput) (*struct{}, error) {
	if err := s.manage(ctx, in.ID, "group_id", in.GroupID); err != nil {
		return nil, err
	}
	if err := s.groups.Delete(ctx, in.ID, in.GroupID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *staffGroupService) addMember(ctx context.Context, in *MemberPathInput) (*GroupOutput, error) {
	if err := s.manage(ctx, in.ID, "group_id", in.GroupID); err != nil {
		return nil, err
	}
	if ok, err := s.groups.InCycle(ctx, in.ID, []string{in.GroupID}); err != nil || !ok {
		return nil, notFoundOr(err)
	}
	if err := RequireStaff(ctx, s.db, in.ID, []string{in.NUID}); err != nil {
		return nil, err
	}
	if err := s.groups.AddMember(ctx, in.GroupID, in.NUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.get(ctx, in.ID, in.GroupID)
}

func (s *staffGroupService) removeMember(ctx context.Context, in *MemberPathInput) (*struct{}, error) {
	if err := s.manage(ctx, in.ID, "group_id", in.GroupID); err != nil {
		return nil, err
	}
	if err := s.groups.RemoveMember(ctx, in.ID, in.GroupID, in.NUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *staffGroupService) listTeams(ctx context.Context, in *utils.CycleScopedInput) (*OpeningTeamsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	teams, err := s.groups.ListTeams(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &OpeningTeamsOutput{Body: teams}, nil
}

func (s *staffGroupService) setTeam(ctx context.Context, in *SetOpeningTeamInput) (*OpeningTeamOutput, error) {
	if !in.Kind.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid kind")
	}
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	groupIDs, err := utils.UUIDList("group_ids", in.Body.GroupIDs)
	if err != nil {
		return nil, err
	}
	if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	ok, err := s.groups.InCycle(ctx, in.ID, groupIDs)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !ok {
		return nil, huma.Error422UnprocessableEntity("group_ids must be groups in this cycle")
	}
	if err := s.groups.SetTeam(ctx, in.ID, in.RoleID, in.Kind, groupIDs); err != nil {
		return nil, utils.StoreErr(err)
	}
	return &OpeningTeamOutput{Body: OpeningTeam{RoleID: in.RoleID, Kind: in.Kind, GroupIDs: groupIDs}}, nil
}

func notFoundOr(err error) error {
	if err != nil {
		return utils.StoreErr(err)
	}
	return huma.Error404NotFound("not found")
}
