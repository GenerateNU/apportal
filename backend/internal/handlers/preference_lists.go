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
		Summary:       "Create a preference list",
		Description:   "Reviewer only. The creator is added as the list's first member. Rejected once the (cycle, role) deadline has passed.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "list-preference-lists",
		Method:      http.MethodGet,
		Path:        "/preference-lists",
		Summary:     "List preference lists for a cycle and role",
		Description: "Reviewer only. Leads only see lists they're a member of; chiefs/admins see every list.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.list)

	// Registered before GET /preference-lists/{id} — this shares the same
	// method and path depth, and huma/Fiber matches literal segments against
	// registration order rather than always preferring them, so a literal
	// route registered after a param route at the same shape loses to it
	// (mirrors why /users/me must precede /users/{nuid} in users.go).
	huma.Register(api, huma.Operation{
		OperationID: "get-lead-meeting-availability",
		Method:      http.MethodGet,
		Path:        "/preference-lists/lead-availability",
		Summary:     "Get several leads' own meeting-availability answers",
		Description: "Reviewer only. Resolved from each lead's own most recent application, for flagging who's free before adding them to a list.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.getLeadAvailability)

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
		Description:   "Chief only. Deletes every member and entry. Allowed even after the (cycle, role) deadline has passed, for administrative cleanup.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.delete)

	huma.Register(api, huma.Operation{
		OperationID:   "add-preference-list-member",
		Method:        http.MethodPost,
		Path:          "/preference-lists/{id}/members",
		Summary:       "Add a lead as a collaborator on a preference list",
		Description:   "Any current member (or a chief/admin) may add another lead, chief, or admin.",
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
		Description: "application_ids must be an exact permutation of the list's current entries, so a stale client can't silently drop one via reorder.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.reorderEntries)

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

// checkNotLocked 403s once the list's (cycle, role) deadline has passed —
// re-checked on every mutating call, not just create, mirroring how
// applications.go guards against writes after the application deadline.
func (h *preferenceListHandler) checkNotLocked(ctx context.Context, list models.PreferenceList) error {
	deadline, err := h.store.GetOrCreatePreferenceListDeadline(ctx, list.CycleID, list.ApplicationRole)
	if err != nil {
		return storeErr(err)
	}
	if preferenceListDeadlinePassed(deadline) {
		return huma.Error403Forbidden("the preference list deadline has passed")
	}
	return nil
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
		CycleID         string      `json:"cycle_id"`
		ApplicationRole models.Role `json:"application_role"`
		Name            string      `json:"name"`
	}
}

func (h *preferenceListHandler) create(ctx context.Context, in *CreatePreferenceListInput) (*PreferenceListOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.CycleID == "" || !in.Body.ApplicationRole.Valid() || strings.TrimSpace(in.Body.Name) == "" {
		return nil, huma.Error422UnprocessableEntity("cycle_id, application_role, and name are required")
	}
	deadline, err := h.store.GetOrCreatePreferenceListDeadline(ctx, in.Body.CycleID, in.Body.ApplicationRole)
	if err != nil {
		return nil, storeErr(err)
	}
	if preferenceListDeadlinePassed(deadline) {
		return nil, huma.Error403Forbidden("the preference list deadline has passed")
	}
	list, err := h.store.CreatePreferenceList(ctx, store.PreferenceListCreate{
		CycleID:         in.Body.CycleID,
		ApplicationRole: in.Body.ApplicationRole,
		Name:            strings.TrimSpace(in.Body.Name),
		CreatedBy:       currentActor(ctx).NUID,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListOutput{Body: list}, nil
}

type ListPreferenceListsInput struct {
	CycleID string      `query:"cycle_id" doc:"Cycle ID"`
	Role    models.Role `query:"role" doc:"Applicant role"`
}

func (h *preferenceListHandler) list(ctx context.Context, in *ListPreferenceListsInput) (*PreferenceListsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.CycleID == "" || !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("cycle_id and role are required")
	}
	actor := currentActor(ctx)
	includeAll := actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin)
	items, err := h.store.ListPreferenceLists(ctx, in.CycleID, in.Role, actor.NUID, includeAll)
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
	if err := h.checkNotLocked(ctx, list); err != nil {
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
	if err := h.checkNotLocked(ctx, list); err != nil {
		return nil, err
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
	if err := h.checkNotLocked(ctx, list); err != nil {
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
	if err := h.checkNotLocked(ctx, list); err != nil {
		return nil, err
	}
	app, err := h.store.GetApplication(ctx, in.ApplicationID)
	if err != nil {
		return nil, storeErr(err)
	}
	if app.CycleID != list.CycleID || app.Role != list.ApplicationRole {
		return nil, huma.Error422UnprocessableEntity("application is not in this list's cycle/role")
	}
	entry, err := h.store.UpsertPreferenceListEntry(ctx, store.PreferenceListEntryUpsert{
		PreferenceListID: in.ID,
		ApplicationID:    in.ApplicationID,
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
	if err := h.checkNotLocked(ctx, list); err != nil {
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
	if err := h.checkNotLocked(ctx, list); err != nil {
		return nil, err
	}
	current, err := h.store.ListPreferenceListEntryApplicationIDs(ctx, in.ID)
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
	if err := h.checkNotLocked(ctx, list); err != nil {
		return nil, err
	}
	updated, err := h.store.UpdatePreferenceListMeetingDay(ctx, in.ID, in.Body.MeetingDay)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreferenceListOutput{Body: updated}, nil
}

type GetLeadAvailabilityInput struct {
	NUIDs string `query:"nuids" doc:"Comma-separated lead NUIDs"`
}

type LeadAvailabilityOutput struct {
	Body []models.LeadMeetingAvailability
}

func (h *preferenceListHandler) getLeadAvailability(ctx context.Context, in *GetLeadAvailabilityInput) (*LeadAvailabilityOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	nuids := parseBulkIDs(in.NUIDs)
	if len(nuids) == 0 {
		return &LeadAvailabilityOutput{Body: []models.LeadMeetingAvailability{}}, nil
	}
	if len(nuids) > maxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many nuids")
	}
	items, err := h.store.GetLeadMeetingAvailability(ctx, nuids)
	if err != nil {
		return nil, storeErr(err)
	}
	return &LeadAvailabilityOutput{Body: items}, nil
}
