package preferencelist

import (
	"context"
	"strings"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type preferenceListService struct {
	applicationDB    *application.ApplicationDB
	preferenceListDB *PreferenceListDB
	userDB           *user.UserDB
}

var validMeetingDays = map[string]bool{
	"monday":    true,
	"tuesday":   true,
	"wednesday": true,
	"thursday":  true,
}

// maxPreferenceListMembers caps how many leads can collaborate on one group
// — a small, fixed team size, not a DB constraint, so it's easy to change.
const maxPreferenceListMembers = 4

// requireAccess rejects callers who aren't a member of the list and aren't a
// chief/admin. Returns 404 (not 403) for a non-member so a list's existence
// isn't leaked to leads who aren't on it.
func (s *preferenceListService) requireAccess(ctx context.Context, listID string) error {
	actor := utils.CurrentActor(ctx)
	if actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		return nil
	}
	isMember, err := s.preferenceListDB.IsPreferenceListMember(ctx, listID, actor.NUID)
	if err != nil {
		return utils.StoreErr(err)
	}
	if !isMember {
		return huma.Error404NotFound("preference list not found")
	}
	return nil
}

func preferenceListDeadlinePassed(d models.PreferenceListDeadline) bool {
	return d.ClosesAt != nil && time.Now().After(*d.ClosesAt)
}

// checkEntryNotLocked 403s once the given role's (cycle, role) deadline has
// passed — re-checked on every shared-entry mutation, mirroring how
// applications.go guards against writes after the application deadline.
// Entry-level mutations (add/remove/reorder/reasoning-edit) are scoped to
// whichever role the target application has, not the whole group.
func (s *preferenceListService) checkEntryNotLocked(ctx context.Context, cycleID string, role models.Role) error {
	deadline, err := s.preferenceListDB.GetOrCreatePreferenceListDeadline(ctx, cycleID, role)
	if err != nil {
		return utils.StoreErr(err)
	}
	if preferenceListDeadlinePassed(deadline) {
		return huma.Error403Forbidden("the preference list deadline has passed")
	}
	return nil
}

// checkGroupNotLocked 403s group-level mutations (rename, submit toggle,
// membership, meeting day, create) once every role's deadline for the cycle
// has passed — a group no longer belongs to one role, so no single role's
// deadline should be able to lock it while another role's window is still
// open.
func (s *preferenceListService) checkGroupNotLocked(ctx context.Context, cycleID string) error {
	for _, role := range models.AllRoles() {
		deadline, err := s.preferenceListDB.GetOrCreatePreferenceListDeadline(ctx, cycleID, role)
		if err != nil {
			return utils.StoreErr(err)
		}
		if !preferenceListDeadlinePassed(deadline) {
			return nil
		}
	}
	return huma.Error403Forbidden("every role's preference list deadline has passed")
}

func (s *preferenceListService) create(ctx context.Context, in *CreatePreferenceListInput) (*PreferenceListOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.CycleID == "" || strings.TrimSpace(in.Body.Name) == "" {
		return nil, huma.Error422UnprocessableEntity("cycle_id and name are required")
	}
	if err := s.checkGroupNotLocked(ctx, in.Body.CycleID); err != nil {
		return nil, err
	}
	list, err := s.preferenceListDB.CreatePreferenceList(ctx, PreferenceListCreate{
		CycleID:   in.Body.CycleID,
		Name:      strings.TrimSpace(in.Body.Name),
		CreatedBy: utils.CurrentActor(ctx).NUID,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListOutput{Body: list}, nil
}

func (s *preferenceListService) list(ctx context.Context, in *ListPreferenceListsInput) (*PreferenceListsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.CycleID == "" {
		return nil, huma.Error422UnprocessableEntity("cycle_id is required")
	}
	actor := utils.CurrentActor(ctx)
	includeAll := actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin)
	items, err := s.preferenceListDB.ListPreferenceLists(ctx, in.CycleID, actor.NUID, includeAll)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListsOutput{Body: items}, nil
}

func (s *preferenceListService) listDetails(ctx context.Context, in *ListPreferenceListsInput) (*PreferenceListDetailsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.CycleID == "" {
		return nil, huma.Error422UnprocessableEntity("cycle_id is required")
	}
	items, err := s.preferenceListDB.ListPreferenceListDetails(ctx, in.CycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	// Comparing your group's picks against every other group is what leads
	// open this for, and a ranked list is the shared artifact. Personal
	// lists and in-group comments are private working notes, so they stay
	// chief/admin only — the side-by-side board never rendered them anyway.
	if !utils.CurrentActor(ctx).HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		for i := range items {
			items[i].PersonalEntries = nil
			items[i].Comments = nil
		}
	}
	return &PreferenceListDetailsOutput{Body: items}, nil
}

func (s *preferenceListService) get(ctx context.Context, in *utils.IDInput) (*PreferenceListDetailOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	detail, err := s.preferenceListDB.GetPreferenceListDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListDetailOutput{Body: detail}, nil
}

func (s *preferenceListService) update(ctx context.Context, in *UpdatePreferenceListInput) (*PreferenceListOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("status is invalid")
	}
	list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if err := s.checkGroupNotLocked(ctx, list.CycleID); err != nil {
		return nil, err
	}
	updated, err := s.preferenceListDB.UpdatePreferenceList(ctx, in.ID, PreferenceListUpdate{
		Name:   in.Body.Name,
		Status: in.Body.Status,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListOutput{Body: updated}, nil
}

func (s *preferenceListService) delete(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.preferenceListDB.DeletePreferenceList(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *preferenceListService) addMember(ctx context.Context, in *AddPreferenceListMemberInput) (*PreferenceListMemberOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.LeadNUID == "" {
		return nil, huma.Error422UnprocessableEntity("lead_nuid is required")
	}
	list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if err := s.checkGroupNotLocked(ctx, list.CycleID); err != nil {
		return nil, err
	}
	memberCount, err := s.preferenceListDB.CountPreferenceListMembers(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if memberCount >= maxPreferenceListMembers {
		return nil, huma.Error422UnprocessableEntity("this group already has the maximum of 4 members")
	}
	target, err := s.userDB.GetUser(ctx, in.Body.LeadNUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	targetActor := middleware.Actor{Roles: target.Roles}
	if !targetActor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin) {
		return nil, huma.Error422UnprocessableEntity("target user is not a lead, chief, or admin")
	}
	member, err := s.preferenceListDB.AddPreferenceListMember(ctx, in.ID, in.Body.LeadNUID, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListMemberOutput{Body: member}, nil
}

func (s *preferenceListService) removeMember(ctx context.Context, in *PreferenceListMemberScopedInput) (*struct{}, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if err := s.checkGroupNotLocked(ctx, list.CycleID); err != nil {
		return nil, err
	}
	if err := s.preferenceListDB.RemovePreferenceListMember(ctx, in.ID, in.MemberID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *preferenceListService) upsertEntry(ctx context.Context, in *UpsertPreferenceListEntryInput) (*PreferenceListEntryOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	app, err := s.applicationDB.GetApplication(ctx, in.ApplicationID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if app.CycleID != list.CycleID {
		return nil, huma.Error422UnprocessableEntity("application is not in this list's cycle")
	}
	if err := s.checkEntryNotLocked(ctx, list.CycleID, app.Role); err != nil {
		return nil, err
	}
	entry, err := s.preferenceListDB.UpsertPreferenceListEntry(ctx, PreferenceListEntryUpsert{
		PreferenceListID: in.ID,
		ApplicationID:    in.ApplicationID,
		Role:             app.Role,
		Reasoning:        in.Body.Reasoning,
		UpdatedBy:        utils.CurrentActor(ctx).NUID,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListEntryOutput{Body: entry}, nil
}

func (s *preferenceListService) deleteEntry(ctx context.Context, in *PreferenceListEntryScopedInput) (*struct{}, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	app, err := s.applicationDB.GetApplication(ctx, in.ApplicationID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if app.CycleID != list.CycleID {
		return nil, huma.Error422UnprocessableEntity("application is not in this list's cycle")
	}
	if err := s.checkEntryNotLocked(ctx, list.CycleID, app.Role); err != nil {
		return nil, err
	}
	if err := s.preferenceListDB.DeletePreferenceListEntry(ctx, in.ID, in.ApplicationID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *preferenceListService) reorderEntries(ctx context.Context, in *ReorderPreferenceListEntriesInput) (*PreferenceListEntriesDetailOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if len(in.Body.ApplicationIDs) == 0 {
		return nil, huma.Error422UnprocessableEntity("application_ids is required")
	}
	roles, err := s.applicationDB.DistinctApplicationRoles(ctx, in.Body.ApplicationIDs, list.CycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if len(roles) != 1 {
		return nil, huma.Error422UnprocessableEntity("application_ids must all share one role within this list's cycle")
	}
	if err := s.checkEntryNotLocked(ctx, list.CycleID, roles[0]); err != nil {
		return nil, err
	}
	current, err := s.preferenceListDB.ListPreferenceListEntryApplicationIDs(ctx, in.ID, roles[0])
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !samePermutation(current, in.Body.ApplicationIDs) {
		return nil, huma.Error422UnprocessableEntity("application_ids must include every current entry exactly once")
	}
	if err := s.preferenceListDB.ReorderPreferenceListEntries(ctx, in.ID, in.Body.ApplicationIDs); err != nil {
		return nil, utils.StoreErr(err)
	}
	detail, err := s.preferenceListDB.GetPreferenceListDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListEntriesDetailOutput{Body: detail.Entries}, nil
}

func samePermutation(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	counts := make(map[string]int, len(a))
	for _, id := range a {
		counts[id]++
	}
	for _, id := range b {
		counts[id]--
		if counts[id] < 0 {
			return false
		}
	}
	return true
}

func (s *preferenceListService) getDeadline(ctx context.Context, in *PreferenceListDeadlineInput) (*PreferenceListDeadlineOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	d, err := s.preferenceListDB.GetOrCreatePreferenceListDeadline(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListDeadlineOutput{Body: d}, nil
}

func (s *preferenceListService) setDeadline(ctx context.Context, in *SetPreferenceListDeadlineInput) (*PreferenceListDeadlineOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	d, err := s.preferenceListDB.UpsertPreferenceListDeadline(ctx, in.ID, in.Role, in.Body.ClosesAt, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListDeadlineOutput{Body: d}, nil
}

func (s *preferenceListService) setMeetingDay(ctx context.Context, in *SetPreferenceListMeetingDayInput) (*PreferenceListOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := s.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.MeetingDay != nil && !validMeetingDays[*in.Body.MeetingDay] {
		return nil, huma.Error422UnprocessableEntity("meeting_day must be monday, tuesday, wednesday, or thursday")
	}
	list, err := s.preferenceListDB.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if err := s.checkGroupNotLocked(ctx, list.CycleID); err != nil {
		return nil, err
	}
	updated, err := s.preferenceListDB.UpdatePreferenceListMeetingDay(ctx, in.ID, in.Body.MeetingDay)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreferenceListOutput{Body: updated}, nil
}
