package draft

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	draftDB := NewDraftDB(db)
	s := &draftService{draftDB: draftDB}

	huma.Register(api, huma.Operation{
		OperationID: "get-draft-board",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/draft",
		Summary:     "The draft board for a cycle and applicant role",
		Description: "Reviewer only. The team order, every pick made, and which slot is on the clock. 404 until a chief opens the board.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.board)

	huma.Register(api, huma.Operation{
		OperationID: "open-draft",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/draft",
		Summary:     "Open the draft board for a cycle and applicant role",
		Description: "Chief only. Idempotent — opening an existing board returns it rather than failing.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, s.open)

	huma.Register(api, huma.Operation{
		OperationID: "update-draft",
		Method:      http.MethodPut,
		Path:        "/drafts/{id}",
		Summary:     "Set a draft's status or round count",
		Description: "Chief only. Moving to active starts the picking; rounds may be raised mid-draft but never below the picks already made.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.update)

	huma.Register(api, huma.Operation{
		OperationID: "set-draft-teams",
		Method:      http.MethodPut,
		Path:        "/drafts/{id}/teams",
		Summary:     "Set the draft order",
		Description: "Chief only. In setup the given preference list groups become the seats, in the given order. While the draft is active the order may still be changed, but the set of teams may not: picks already made stay with the team that made them, and the rest of the round goes to the teams yet to pick in it.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.setTeams)

	huma.Register(api, huma.Operation{
		OperationID: "make-draft-pick",
		Method:      http.MethodPost,
		Path:        "/drafts/{id}/picks",
		Summary:     "Claim an applicant for the team on the clock",
		Description: "Chief only. Fills the lowest open slot unless pick_number names another, and moves the applicant to the accepted stage.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.pick)

	huma.Register(api, huma.Operation{
		OperationID: "replace-draft-pick",
		Method:      http.MethodPut,
		Path:        "/drafts/{id}/picks/{pick_number}",
		Summary:     "Swap the applicant in a slot that's already been picked",
		Description: "Chief only. Done in place, so the slot never reopens and the team on the clock doesn't change. The outgoing applicant returns to their previous stage and the incoming one moves to accepted.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.replacePick)

	huma.Register(api, huma.Operation{
		OperationID:   "remove-draft-pick",
		Method:        http.MethodDelete,
		Path:          "/drafts/{id}/picks/{pick_number}",
		Summary:       "Empty a slot and undo its stage change",
		Description:   "Chief only. The applicant returns to the stage they were in before the pick, and the slot goes back on the clock.",
		Tags:          []string{"Draft"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.removePick)

	huma.Register(api, huma.Operation{
		OperationID: "reset-draft",
		Method:      http.MethodPost,
		Path:        "/drafts/{id}/reset",
		Summary:     "Clear every pick and return the board to setup",
		Description: "Chief only. Each applicant goes back to the stage they were in before their pick; the team order is kept, so a rehearsal can be wiped without rebuilding it.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.reset)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-draft",
		Method:        http.MethodDelete,
		Path:          "/drafts/{id}",
		Summary:       "Delete a draft board",
		Description:   "Chief only. Undoes every pick's stage change, then removes the board, its order, and its picks.",
		Tags:          []string{"Draft"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.delete)

	huma.Register(api, huma.Operation{
		OperationID: "list-drafted-applications",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/drafted",
		Summary:     "Which applicants a cycle's drafts have already claimed",
		Description: "Reviewer only. Application id to the team name that took them, for marking them as taken wherever they're still listed.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.drafted)
}
