package meetingslot

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB) {
	register(api, newService(access.NewChecker(db), db))
}

func register(api huma.API, s *meetingSlotService) {
	tags := []string{"Meeting slots"}
	errs := []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity}
	conflict := append(errs, http.StatusConflict)

	huma.Register(api, huma.Operation{
		OperationID: "list-meeting-slots", Method: http.MethodGet, Path: "/cycles/{id}/meeting-slots",
		Summary: "List a cycle's meeting slots in order", Description: "Chief or admin.", Tags: tags, Errors: errs,
	}, s.list)
	huma.Register(api, huma.Operation{
		OperationID: "create-meeting-slot", Method: http.MethodPost, Path: "/cycles/{id}/meeting-slots",
		Summary: "Add a meeting slot at the end", Description: "Chief or admin. Labels are unique per cycle.",
		Tags: tags, DefaultStatus: http.StatusCreated, Errors: conflict,
	}, s.create)
	huma.Register(api, huma.Operation{
		OperationID: "reorder-meeting-slots", Method: http.MethodPut, Path: "/cycles/{id}/meeting-slots/order",
		Summary: "Reorder a cycle's meeting slots", Description: "Chief or admin. Must list every slot exactly once.",
		Tags: tags, Errors: errs,
	}, s.reorder)
	huma.Register(api, huma.Operation{
		OperationID: "rename-meeting-slot", Method: http.MethodPatch, Path: "/cycles/{id}/meeting-slots/{slot_id}",
		Summary: "Rename a meeting slot", Description: "Chief or admin.", Tags: tags, Errors: conflict,
	}, s.rename)
	huma.Register(api, huma.Operation{
		OperationID: "delete-meeting-slot", Method: http.MethodDelete, Path: "/cycles/{id}/meeting-slots/{slot_id}",
		Summary:     "Delete a meeting slot",
		Description: "Chief or admin. Clears it from staff and applicants who had it.",
		Tags:        tags, DefaultStatus: http.StatusNoContent, Errors: errs,
	}, s.remove)
	huma.Register(api, huma.Operation{
		OperationID: "list-staff-slots", Method: http.MethodGet, Path: "/cycles/{id}/staff-slots",
		Summary: "List each staff member's meeting slot", Description: "Chief or admin.", Tags: tags, Errors: errs,
	}, s.listStaffSlots)
	huma.Register(api, huma.Operation{
		OperationID: "set-staff-slot", Method: http.MethodPut, Path: "/cycles/{id}/staff-slots/{nuid}",
		Summary: "Set a staff member's meeting slot", Description: "Chief or admin. One slot per person per cycle.",
		Tags: tags, Errors: errs,
	}, s.setStaffSlot)
	huma.Register(api, huma.Operation{
		OperationID: "clear-staff-slot", Method: http.MethodDelete, Path: "/cycles/{id}/staff-slots/{nuid}",
		Summary: "Clear a staff member's meeting slot", Description: "Chief or admin.",
		Tags: tags, DefaultStatus: http.StatusNoContent, Errors: errs,
	}, s.clearStaffSlot)
	huma.Register(api, huma.Operation{
		OperationID: "set-match-by-slot", Method: http.MethodPut, Path: "/cycles/{id}/match-by-slot",
		Summary:     "Turn meeting-slot matching on or off",
		Description: "Chief or admin. The default for the interview auto-plan's match_slots.",
		Tags:        tags, Errors: errs,
	}, s.setMatchBySlot)
	huma.Register(api, huma.Operation{
		OperationID: "get-application-slots", Method: http.MethodGet, Path: "/applications/{id}/slots",
		Summary: "Get the meeting slots an applicant can make", Description: "The applicant, or staff who can see the application.",
		Tags: tags, Errors: errs,
	}, s.applicationSlots)
	huma.Register(api, huma.Operation{
		OperationID: "set-application-slots", Method: http.MethodPut, Path: "/applications/{id}/slots",
		Summary:     "Set the meeting slots you can make",
		Description: "The applicant only, from their cycle's slots, until the interview is being scheduled. Replaces the set.",
		Tags:        tags, Errors: conflict,
	}, s.setApplicationSlots)
}
