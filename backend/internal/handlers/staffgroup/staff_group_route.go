package staffgroup

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB) {
	register(api, newService(access.NewChecker(db), db))
}

func register(api huma.API, s *staffGroupService) {
	tags := []string{"Staff groups"}
	read := []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity}
	write := append(read, http.StatusConflict)

	huma.Register(api, huma.Operation{
		OperationID: "list-staff-groups", Method: http.MethodGet, Path: "/cycles/{id}/staff-groups",
		Summary: "List a cycle's staff groups with their members", Description: "Chief or admin.",
		Tags: tags, Errors: read,
	}, s.list)
	huma.Register(api, huma.Operation{
		OperationID: "list-staff-group-candidates", Method: http.MethodGet, Path: "/cycles/{id}/staff-groups/candidates",
		Summary: "List who can be added to a cycle's staff groups", Description: "Chief or admin. The cycle's staff, or every admin on a chief cycle.",
		Tags: tags, Errors: read,
	}, s.candidates)
	huma.Register(api, huma.Operation{
		OperationID: "create-staff-group", Method: http.MethodPost, Path: "/cycles/{id}/staff-groups",
		Summary:     "Create a staff group",
		Description: "Chief or admin. Members must already be on the cycle's staff; groups never add or remove staff.",
		Tags:        tags, DefaultStatus: http.StatusCreated, Errors: write,
	}, s.create)
	huma.Register(api, huma.Operation{
		OperationID: "rename-staff-group", Method: http.MethodPatch, Path: "/cycles/{id}/staff-groups/{group_id}",
		Summary: "Rename a staff group", Description: "Chief or admin.", Tags: tags, Errors: write,
	}, s.rename)
	huma.Register(api, huma.Operation{
		OperationID: "delete-staff-group", Method: http.MethodDelete, Path: "/cycles/{id}/staff-groups/{group_id}",
		Summary: "Delete a staff group", Description: "Chief or admin. Also removes it from any opening team.",
		Tags: tags, DefaultStatus: http.StatusNoContent, Errors: read,
	}, s.remove)
	huma.Register(api, huma.Operation{
		OperationID: "add-staff-group-member", Method: http.MethodPut, Path: "/cycles/{id}/staff-groups/{group_id}/members/{nuid}",
		Summary: "Add someone to a staff group", Description: "Chief or admin. They must be on the cycle's staff.",
		Tags: tags, Errors: read,
	}, s.addMember)
	huma.Register(api, huma.Operation{
		OperationID: "remove-staff-group-member", Method: http.MethodDelete, Path: "/cycles/{id}/staff-groups/{group_id}/members/{nuid}",
		Summary: "Remove someone from a staff group", Description: "Chief or admin.",
		Tags: tags, DefaultStatus: http.StatusNoContent, Errors: read,
	}, s.removeMember)
	huma.Register(api, huma.Operation{
		OperationID: "list-opening-teams", Method: http.MethodGet, Path: "/cycles/{id}/opening-teams",
		Summary:     "List which groups staff each opening",
		Description: "Chief or admin. An opening with no groups for a kind is staffed by the whole cycle staff; recording reviews with none fall back to the interviewers' groups.",
		Tags:        tags, Errors: read,
	}, s.listTeams)
	huma.Register(api, huma.Operation{
		OperationID: "set-opening-team", Method: http.MethodPut, Path: "/cycles/{id}/opening-teams/{role_id}/{kind}",
		Summary: "Choose the groups that do one kind of work on an opening", Description: "Chief or admin. Replaces the set; empty clears it.",
		Tags: tags, Errors: read,
	}, s.setTeam)
}
