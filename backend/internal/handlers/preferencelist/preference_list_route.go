package preferencelist

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	applicationDB := application.NewApplicationDB(db)
	preferenceListDB := NewPreferenceListDB(db)
	userDB := user.NewUserDB(db)
	s := &preferenceListService{applicationDB: applicationDB, preferenceListDB: preferenceListDB, userDB: userDB}

	huma.Register(api, huma.Operation{
		OperationID:   "create-preference-list",
		Method:        http.MethodPost,
		Path:          "/preference-lists",
		Summary:       "Create a preference list group for a cycle",
		Description:   "Reviewer only. The creator is added as the group's first member. Rejected once every role's preference-list deadline for the cycle has passed.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "list-preference-lists",
		Method:      http.MethodGet,
		Path:        "/preference-lists",
		Summary:     "List preference list groups for a cycle",
		Description: "Reviewer only. Leads only see groups they're a member of; chiefs/admins see every group. Each group covers every role in the cycle.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "list-preference-list-details",
		Method:      http.MethodGet,
		Path:        "/preference-lists/details",
		Summary:     "List every preference list group's full detail for a cycle",
		Description: "Reviewer only. Bundles every group's members and ranked entries in one call, for viewing every group side by side. Personal entries and comments are chief/admin only — a lead sees every group's picks, not other leads' private working notes.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.listDetails)

	huma.Register(api, huma.Operation{
		OperationID: "get-preference-list",
		Method:      http.MethodGet,
		Path:        "/preference-lists/{id}",
		Summary:     "Get a preference list's members and entries",
		Description: "Reviewer only. Not found (rather than forbidden) for a lead who isn't a member, so a list's existence isn't leaked.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID: "update-preference-list",
		Method:      http.MethodPatch,
		Path:        "/preference-lists/{id}",
		Summary:     "Rename a preference list or toggle its submitted status",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-preference-list",
		Method:        http.MethodDelete,
		Path:          "/preference-lists/{id}",
		Summary:       "Delete a preference list",
		Description:   "Chief only. Deletes every member and entry. Allowed even after every role's deadline has passed, for administrative cleanup.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.delete)

	huma.Register(api, huma.Operation{
		OperationID:   "add-preference-list-member",
		Method:        http.MethodPost,
		Path:          "/preference-lists/{id}/members",
		Summary:       "Add a lead as a collaborator on a preference list",
		Description:   "Any current member (or a chief/admin) may add another lead, chief, or admin. Rejected once the group has 4 members.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.addMember)

	huma.Register(api, huma.Operation{
		OperationID:   "remove-preference-list-member",
		Method:        http.MethodDelete,
		Path:          "/preference-lists/{id}/members/{memberId}",
		Summary:       "Remove a collaborator from a preference list",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.removeMember)

	huma.Register(api, huma.Operation{
		OperationID: "upsert-preference-list-entry",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/entries/{applicationId}",
		Summary:     "Add an applicant to a preference list, or edit their reasoning",
		Description: "Adding for the first time appends to the end of the rank order; editing reasoning never changes rank.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.upsertEntry)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-preference-list-entry",
		Method:        http.MethodDelete,
		Path:          "/preference-lists/{id}/entries/{applicationId}",
		Summary:       "Remove an applicant from a preference list",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.deleteEntry)

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
	}, s.reorderEntries)

	huma.Register(api, huma.Operation{
		OperationID: "upsert-preference-list-personal-entry",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/personal-entries/{applicationId}",
		Summary:     "Add an applicant to your own personal list within a group, or edit your reasoning",
		Description: "Every group member's personal list is visible to the whole group, but only its owner can write to it. Never deadline-gated.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.upsertPersonalEntry)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-preference-list-personal-entry",
		Method:        http.MethodDelete,
		Path:          "/preference-lists/{id}/personal-entries/{applicationId}",
		Summary:       "Remove an applicant from your own personal list",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.deletePersonalEntry)

	// A sibling of /personal-entries/{applicationId}, not nested under it,
	// for the same literal-vs-param routing reason as /entry-order above.
	huma.Register(api, huma.Operation{
		OperationID: "reorder-preference-list-personal-entries",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/personal-entry-order",
		Summary:     "Reorder your own personal list's entries",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.reorderPersonalEntries)

	huma.Register(api, huma.Operation{
		OperationID:   "create-preference-list-comment",
		Method:        http.MethodPost,
		Path:          "/preference-lists/{id}/comments",
		Summary:       "Add a comment on a preference list group or one of its applicants",
		Description:   "Any group member (or chief/admin) may post. Omit application_id for a comment on the group as a whole; set it to comment on one applicant in the shared list. Never deadline-gated.",
		Tags:          []string{"Preference lists"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.createComment)

	huma.Register(api, huma.Operation{
		OperationID: "update-preference-list-comment",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/comments/{commentId}",
		Summary:     "Edit a preference list comment",
		Description: "Only the comment's own author may edit it.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.updateComment)

	huma.Register(api, huma.Operation{
		OperationID: "get-preference-list-deadline",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/preference-list-deadline",
		Summary:     "Get the preference-list submission deadline for a cycle's role",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.getDeadline)

	huma.Register(api, huma.Operation{
		OperationID: "set-preference-list-deadline",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/preference-list-deadline",
		Summary:     "Set the preference-list submission deadline for a cycle's role",
		Description: "Chief only. Every preference list for that (cycle, role) locks for editing once this passes, submitted or not.",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.setDeadline)

	huma.Register(api, huma.Operation{
		OperationID: "set-preference-list-meeting-day",
		Method:      http.MethodPut,
		Path:        "/preference-lists/{id}/meeting-day",
		Summary:     "Set (or clear) the day this list's members plan to meet",
		Tags:        []string{"Preference lists"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.setMeetingDay)
}
