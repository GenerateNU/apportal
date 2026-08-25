package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type preferenceListHandler struct {
	store *store.Store
}

func (h *preferenceListHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-preference-list",
		Method:        http.MethodPost,
		Path:          "/preference-lists",
		Summary:       "Create a preference list group for a cycle",
		Description:   "Reviewer only. The creator is added as the group's first member. Rejected once every role's preference-list deadline for the cycle has passed.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "list-preference-lists",
		Method:      http.MethodGet,
		Path:        "/preference-lists",
		Summary:     "List preference list groups for a cycle",
		Description: "Reviewer only. Leads only see groups they're a member of; chiefs/admins see every group. Each group covers every role in the cycle.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "get-preference-list",
		Method:      http.MethodGet,
		Path:        "/preference-lists/{id}",
		Summary:     "Get a preference list's members and entries",
		Description: "Reviewer only. Not found (rather than forbidden) for a lead who isn't a member, so a list's existence isn't leaked.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, h.get)

	huma.Register(api, huma.Operation{
		OperationID: "update-preference-list",
		Method:      http.MethodPatch,
		Path:        "/preference-lists/{id}",
		Summary:     "Rename a preference list or toggle its submitted status",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-preference-list",
		Method:        http.MethodDelete,
		Path:          "/preference-lists/{id}",
		Summary:       "Delete a preference list",
		Description:   "Chief only. Deletes every member and entry. Allowed even after every role's deadline has passed, for administrative cleanup.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.delete)

	huma.Register(api, huma.Operation{
		OperationID:   "add-preference-list-member",
		Method:        http.MethodPost,
		Path:          "/preference-lists/{id}/members",
		Summary:       "Add a lead as a collaborator on a preference list",
		Description:   "Any current member (or a chief/admin) may add another lead, chief, or admin. Rejected once the group has 4 members.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, h.addMember)

	huma.Register(api, huma.Operation{
		OperationID:   "remove-preference-list-member",
		Method:        http.MethodDelete,
		Path:          "/preference-lists/{id}/members/{memberId}",
		Summary:       "Remove a collaborator from a preference list",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.removeMember)

	huma.Register(api, huma.Operation{
		OperationID: "upsert-preference-list-entry",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/entries/{applicationId}",
		Summary:     "Add an applicant to a preference list, or edit their reasoning",
		Description: "Adding for the first time appends to the end of the rank order; editing reasoning never changes rank.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.upsertEntry)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-preference-list-entry",
		Method:        http.MethodDelete,
		Path:          "/preference-lists/{id}/entries/{applicationId}",
		Summary:       "Remove an applicant from a preference list",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.deleteEntry)

	// A sibling of /entries/{applicationId}, not nested under it, to avoid
	// ambiguity in the router between a literal segment and a path-param
	// segment at the same depth.
	huma.Register(api, huma.Operation{
		OperationID: "reorder-preference-list-entries",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/entry-order",
		Summary:     "Reorder a preference list's entries",
		Description: "application_ids must be an exact permutation of the list's current entries for one role, so a stale client can't silently drop one via reorder.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.reorderEntries)

	huma.Register(api, huma.Operation{
		OperationID: "upsert-preference-list-personal-entry",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/personal-entries/{applicationId}",
		Summary:     "Add an applicant to your own personal list within a group, or edit your reasoning",
		Description: "Every group member's personal list is visible to the whole group, but only its owner can write to it. Never deadline-gated.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.upsertPersonalEntry)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-preference-list-personal-entry",
		Method:        http.MethodDelete,
		Path:          "/preference-lists/{id}/personal-entries/{applicationId}",
		Summary:       "Remove an applicant from your own personal list",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.deletePersonalEntry)

	// A sibling of /personal-entries/{applicationId}, not nested under it,
	// for the same literal-vs-param routing reason as /entry-order above.
	huma.Register(api, huma.Operation{
		OperationID: "reorder-preference-list-personal-entries",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/personal-entry-order",
		Summary:     "Reorder your own personal list's entries",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.reorderPersonalEntries)

	huma.Register(api, huma.Operation{
		OperationID:   "create-preference-list-comment",
		Method:        http.MethodPost,
		Path:          "/preference-lists/{id}/comments",
		Summary:       "Add a comment on a preference list group or one of its applicants",
		Description:   "Any group member (or chief/admin) may post. Omit application_id for a comment on the group as a whole; set it to comment on one applicant in the shared list. Never deadline-gated.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.createComment)

	huma.Register(api, huma.Operation{
		OperationID: "update-preference-list-comment",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/comments/{commentId}",
		Summary:     "Edit a preference list comment",
		Description: "Only the comment's own author may edit it.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.updateComment)

	huma.Register(api, huma.Operation{
		OperationID: "get-preference-list-deadline",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/preference-list-deadline",
		Summary:     "Get the preference-list submission deadline for a cycle's role",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.getDeadline)

	huma.Register(api, huma.Operation{
		OperationID: "set-preference-list-deadline",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/preference-list-deadline",
		Summary:     "Set the preference-list submission deadline for a cycle's role",
		Description: "Chief only. Every preference list for that (cycle, role) locks for editing once this passes, submitted or not.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.setDeadline)

	huma.Register(api, huma.Operation{
		OperationID: "set-preference-list-meeting-day",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/meeting-day",
		Summary:     "Set (or clear) the day this list's members plan to meet",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.setMeetingDay)
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
func (h *preferenceListHandler) requireAccess(ctx context.Context, listID string) error {
	actor := currentActor(ctx)
	if actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		return nil
	}
	isMember, err := h.store.IsPreferenceListMember(ctx, listID, actor.NUID)
	if err != nil {
		return storeErr(err)
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
func (h *preferenceListHandler) checkEntryNotLocked(ctx context.Context, cycleID string, role models.Role) error {
	deadline, err := h.store.GetOrCreatePreferenceListDeadline(ctx, cycleID, role)
	if err != nil {
		return storeErr(err)
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
func (h *preferenceListHandler) checkGroupNotLocked(ctx context.Context, cycleID string) error {
	for _, role := range models.AllRoles() {
		deadline, err := h.store.GetOrCreatePreferenceListDeadline(ctx, cycleID, role)
		if err != nil {
			return storeErr(err)
		}
		if !preferenceListDeadlinePassed(deadline) {
			return nil
		}
	}
	return huma.Error403Forbidden("every role's preference list deadline has passed")
}

type PreferenceListOutput struct {
	Body models.PreferenceList
}

type PreferenceListDetailOutput struct {
	Body models.PreferenceListDetail
}

type PreferenceListsOutput struct {
	Body []models.PreferenceListSummary
}

type CreatePreferenceListInput struct {
	Body struct {
		CycleID string `json:"cycle_id"`
		Name    string `json:"name"`
	}
}

func (h *preferenceListHandler) create(ctx context.Context, in *CreatePreferenceListInput) (*PreferenceListOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.CycleID == "" || strings.TrimSpace(in.Body.Name) == "" {
		return nil, huma.Error422UnprocessableEntity("cycle_id and name are required")
	}
	if err := h.checkGroupNotLocked(ctx, in.Body.CycleID); err != nil {
		return nil, err
	}
	list, err := h.store.CreatePreferenceList(ctx, store.PreferenceListCreate{
		CycleID:   in.Body.CycleID,
		Name:      strings.TrimSpace(in.Body.Name),
		CreatedBy: currentActor(ctx).NUID,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListOutput{Body: list}, nil
}

type ListPreferenceListsInput struct {
	CycleID string `query:"cycle_id" doc:"Cycle ID"`
}

func (h *preferenceListHandler) list(ctx context.Context, in *ListPreferenceListsInput) (*PreferenceListsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.CycleID == "" {
		return nil, huma.Error422UnprocessableEntity("cycle_id is required")
	}
	actor := currentActor(ctx)
	includeAll := actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin)
	items, err := h.store.ListPreferenceLists(ctx, in.CycleID, actor.NUID, includeAll)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListsOutput{Body: items}, nil
}

func (h *preferenceListHandler) get(ctx context.Context, in *IDInput) (*PreferenceListDetailOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	detail, err := h.store.GetPreferenceListDetail(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListDetailOutput{Body: detail}, nil
}

type UpdatePreferenceListInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		Name   *string                      `json:"name,omitempty"`
		Status *models.PreferenceListStatus `json:"status,omitempty"`
	}
}

func (h *preferenceListHandler) update(ctx context.Context, in *UpdatePreferenceListInput) (*PreferenceListOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("status is invalid")
	}
	list, err := h.store.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if err := h.checkGroupNotLocked(ctx, list.CycleID); err != nil {
		return nil, err
	}
	updated, err := h.store.UpdatePreferenceList(ctx, in.ID, store.PreferenceListUpdate{
		Name:   in.Body.Name,
		Status: in.Body.Status,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListOutput{Body: updated}, nil
}

func (h *preferenceListHandler) delete(ctx context.Context, in *IDInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeletePreferenceList(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

type PreferenceListMemberOutput struct {
	Body models.PreferenceListMember
}

type AddPreferenceListMemberInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		LeadNUID string `json:"lead_nuid"`
	}
}

func (h *preferenceListHandler) addMember(ctx context.Context, in *AddPreferenceListMemberInput) (*PreferenceListMemberOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.LeadNUID == "" {
		return nil, huma.Error422UnprocessableEntity("lead_nuid is required")
	}
	list, err := h.store.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if err := h.checkGroupNotLocked(ctx, list.CycleID); err != nil {
		return nil, err
	}
	memberCount, err := h.store.CountPreferenceListMembers(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if memberCount >= maxPreferenceListMembers {
		return nil, huma.Error422UnprocessableEntity("this group already has the maximum of 4 members")
	}
	target, err := h.store.GetUser(ctx, in.Body.LeadNUID)
	if err != nil {
		return nil, storeErr(err)
	}
	targetActor := middleware.Actor{Roles: target.Roles}
	if !targetActor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin) {
		return nil, huma.Error422UnprocessableEntity("target user is not a lead, chief, or admin")
	}
	member, err := h.store.AddPreferenceListMember(ctx, in.ID, in.Body.LeadNUID, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListMemberOutput{Body: member}, nil
}

type PreferenceListMemberScopedInput struct {
	ID       string `path:"id" doc:"Preference list ID"`
	MemberID string `path:"memberId" doc:"Preference list member ID"`
}

func (h *preferenceListHandler) removeMember(ctx context.Context, in *PreferenceListMemberScopedInput) (*struct{}, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := h.store.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if err := h.checkGroupNotLocked(ctx, list.CycleID); err != nil {
		return nil, err
	}
	if err := h.store.RemovePreferenceListMember(ctx, in.ID, in.MemberID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

type PreferenceListEntryOutput struct {
	Body models.PreferenceListEntry
}

type PreferenceListEntryScopedInput struct {
	ID            string `path:"id" doc:"Preference list ID"`
	ApplicationID string `path:"applicationId" doc:"Application ID"`
}

type UpsertPreferenceListEntryInput struct {
	ID            string `path:"id" doc:"Preference list ID"`
	ApplicationID string `path:"applicationId" doc:"Application ID"`
	Body          struct {
		// nil leaves any existing reasoning untouched; pass "" to clear it.
		Reasoning *string `json:"reasoning,omitempty"`
	}
}

func (h *preferenceListHandler) upsertEntry(ctx context.Context, in *UpsertPreferenceListEntryInput) (*PreferenceListEntryOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := h.store.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	app, err := h.store.GetApplication(ctx, in.ApplicationID)
	if err != nil {
		return nil, storeErr(err)
	}
	if app.CycleID != list.CycleID {
		return nil, huma.Error422UnprocessableEntity("application is not in this list's cycle")
	}
	if err := h.checkEntryNotLocked(ctx, list.CycleID, app.Role); err != nil {
		return nil, err
	}
	entry, err := h.store.UpsertPreferenceListEntry(ctx, store.PreferenceListEntryUpsert{
		PreferenceListID: in.ID,
		ApplicationID:    in.ApplicationID,
		Role:             app.Role,
		Reasoning:        in.Body.Reasoning,
		UpdatedBy:        currentActor(ctx).NUID,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListEntryOutput{Body: entry}, nil
}

func (h *preferenceListHandler) deleteEntry(ctx context.Context, in *PreferenceListEntryScopedInput) (*struct{}, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := h.store.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	app, err := h.store.GetApplication(ctx, in.ApplicationID)
	if err != nil {
		return nil, storeErr(err)
	}
	if app.CycleID != list.CycleID {
		return nil, huma.Error422UnprocessableEntity("application is not in this list's cycle")
	}
	if err := h.checkEntryNotLocked(ctx, list.CycleID, app.Role); err != nil {
		return nil, err
	}
	if err := h.store.DeletePreferenceListEntry(ctx, in.ID, in.ApplicationID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

type ReorderPreferenceListEntriesInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		ApplicationIDs []string `json:"application_ids"`
	}
}

type PreferenceListEntriesDetailOutput struct {
	Body []models.PreferenceListEntryDetail
}

func (h *preferenceListHandler) reorderEntries(ctx context.Context, in *ReorderPreferenceListEntriesInput) (*PreferenceListEntriesDetailOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	list, err := h.store.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if len(in.Body.ApplicationIDs) == 0 {
		return nil, huma.Error422UnprocessableEntity("application_ids is required")
	}
	roles, err := h.store.DistinctApplicationRoles(ctx, in.Body.ApplicationIDs, list.CycleID)
	if err != nil {
		return nil, storeErr(err)
	}
	if len(roles) != 1 {
		return nil, huma.Error422UnprocessableEntity("application_ids must all share one role within this list's cycle")
	}
	if err := h.checkEntryNotLocked(ctx, list.CycleID, roles[0]); err != nil {
		return nil, err
	}
	current, err := h.store.ListPreferenceListEntryApplicationIDs(ctx, in.ID, roles[0])
	if err != nil {
		return nil, storeErr(err)
	}
	if !samePermutation(current, in.Body.ApplicationIDs) {
		return nil, huma.Error422UnprocessableEntity("application_ids must include every current entry exactly once")
	}
	if err := h.store.ReorderPreferenceListEntries(ctx, in.ID, in.Body.ApplicationIDs); err != nil {
		return nil, storeErr(err)
	}
	detail, err := h.store.GetPreferenceListDetail(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
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

type PreferenceListDeadlineOutput struct {
	Body models.PreferenceListDeadline
}

type PreferenceListDeadlineInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

func (h *preferenceListHandler) getDeadline(ctx context.Context, in *PreferenceListDeadlineInput) (*PreferenceListDeadlineOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	d, err := h.store.GetOrCreatePreferenceListDeadline(ctx, in.ID, in.Role)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListDeadlineOutput{Body: d}, nil
}

type SetPreferenceListDeadlineInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
	Body struct {
		ClosesAt *time.Time `json:"closes_at,omitempty"`
	}
}

func (h *preferenceListHandler) setDeadline(ctx context.Context, in *SetPreferenceListDeadlineInput) (*PreferenceListDeadlineOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	d, err := h.store.UpsertPreferenceListDeadline(ctx, in.ID, in.Role, in.Body.ClosesAt, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListDeadlineOutput{Body: d}, nil
}

type SetPreferenceListMeetingDayInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		MeetingDay *string `json:"meeting_day,omitempty" doc:"monday, tuesday, wednesday, or thursday; omit/null to clear"`
	}
}

func (h *preferenceListHandler) setMeetingDay(ctx context.Context, in *SetPreferenceListMeetingDayInput) (*PreferenceListOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := h.requireAccess(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.MeetingDay != nil && !validMeetingDays[*in.Body.MeetingDay] {
		return nil, huma.Error422UnprocessableEntity("meeting_day must be monday, tuesday, wednesday, or thursday")
	}
	list, err := h.store.GetPreferenceList(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if err := h.checkGroupNotLocked(ctx, list.CycleID); err != nil {
		return nil, err
	}
	updated, err := h.store.UpdatePreferenceListMeetingDay(ctx, in.ID, in.Body.MeetingDay)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListOutput{Body: updated}, nil
}
