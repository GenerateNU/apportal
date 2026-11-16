package interviewpanel

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB) {
	register(api, newService(access.NewChecker(db), db))
}

func register(api huma.API, s *interviewPanelService) {
	tags := []string{"Interview panels"}
	errs := []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity}
	conflict := append(errs, http.StatusConflict)

	huma.Register(api, huma.Operation{
		OperationID: "list-interview-panels", Method: http.MethodGet, Path: "/cycles/{id}/interview-panels",
		Summary: "List a cycle's interview panels with their members", Description: "Chief or admin.",
		Tags: tags, Errors: errs,
	}, s.list)
	huma.Register(api, huma.Operation{
		OperationID: "create-interview-panel", Method: http.MethodPost, Path: "/cycles/{id}/interview-panels",
		Summary:     "Create an interview panel",
		Description: "Chief or admin. Members must be cycle staff, and each person sits on at most one panel per cycle.",
		Tags:        tags, DefaultStatus: http.StatusCreated, Errors: conflict,
	}, s.create)
	huma.Register(api, huma.Operation{
		OperationID: "auto-create-interview-panels", Method: http.MethodPost, Path: "/cycles/{id}/interview-panels/auto",
		Summary:     "Make panels of a given size from everyone not on one yet",
		Description: "Chief or admin. Uses people who may interview (for role_id, or for any opening), keeps people with the same meeting slot together, and saves every panel in one transaction. The last panel may be short.",
		Tags:        tags, DefaultStatus: http.StatusCreated, Errors: conflict,
	}, s.auto)
	huma.Register(api, huma.Operation{
		OperationID: "rename-interview-panel", Method: http.MethodPatch, Path: "/cycles/{id}/interview-panels/{panel_id}",
		Summary: "Rename an interview panel", Description: "Chief or admin.", Tags: tags, Errors: conflict,
	}, s.rename)
	huma.Register(api, huma.Operation{
		OperationID: "delete-interview-panel", Method: http.MethodDelete, Path: "/cycles/{id}/interview-panels/{panel_id}",
		Summary: "Delete an interview panel", Description: "Chief or admin. Existing interview assignments stay.",
		Tags: tags, DefaultStatus: http.StatusNoContent, Errors: errs,
	}, s.remove)
	huma.Register(api, huma.Operation{
		OperationID: "add-interview-panel-member", Method: http.MethodPut, Path: "/cycles/{id}/interview-panels/{panel_id}/members/{nuid}",
		Summary: "Put someone on a panel", Description: "Chief or admin. 409 if they're on another panel this cycle.",
		Tags: tags, Errors: conflict,
	}, s.addMember)
	huma.Register(api, huma.Operation{
		OperationID: "remove-interview-panel-member", Method: http.MethodDelete, Path: "/cycles/{id}/interview-panels/{panel_id}/members/{nuid}",
		Summary: "Take someone off a panel", Description: "Chief or admin.",
		Tags: tags, DefaultStatus: http.StatusNoContent, Errors: errs,
	}, s.removeMember)
}
