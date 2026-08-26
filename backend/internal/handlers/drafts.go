package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// maxDraftRounds bounds the board so one bad number can't render thousands of
// empty slots.
const maxDraftRounds = 50

// draftHandler runs the snake draft: one board per (cycle, applicant role),
// teams are preference_lists groups, and a single operator drives it. Reads
// are open to any reviewer so the room can follow along; every write is
// chief-only.
type draftHandler struct {
	store *store.Store
}

func (h *draftHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-draft-board",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/draft",
		Summary:     "The draft board for a cycle and applicant role",
		Description: "Reviewer only. The team order, every pick made, and which slot is on the clock. 404 until a chief opens the board.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.board)

	huma.Register(api, huma.Operation{
		OperationID: "open-draft",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/draft",
		Summary:     "Open the draft board for a cycle and applicant role",
		Description: "Chief only. Idempotent — opening an existing board returns it rather than failing.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.open)

	huma.Register(api, huma.Operation{
		OperationID: "update-draft",
		Method:      http.MethodPut,
		Path:        "/drafts/{id}",
		Summary:     "Set a draft's status or round count",
		Description: "Chief only. Moving to active starts the picking; rounds may be raised mid-draft but never below the picks already made.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.update)

	huma.Register(api, huma.Operation{
		OperationID: "set-draft-teams",
		Method:      http.MethodPut,
		Path:        "/drafts/{id}/teams",
		Summary:     "Set the draft order",
		Description: "Chief only, and only while the draft is in setup: the given preference list groups become the seats, in the given order.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, h.setTeams)

	huma.Register(api, huma.Operation{
		OperationID: "make-draft-pick",
		Method:      http.MethodPost,
		Path:        "/drafts/{id}/picks",
		Summary:     "Claim an applicant for the team on the clock",
		Description: "Chief only. Fills the lowest open slot unless pick_number names another, and moves the applicant to the accepted stage.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, h.pick)

	huma.Register(api, huma.Operation{
		OperationID:   "remove-draft-pick",
		Method:        http.MethodDelete,
		Path:          "/drafts/{id}/picks/{pick_number}",
		Summary:       "Empty a slot and undo its stage change",
		Description:   "Chief only. The applicant returns to the stage they were in before the pick, and the slot goes back on the clock.",
		Tags:          []string{"Draft"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.removePick)

	huma.Register(api, huma.Operation{
		OperationID: "reset-draft",
		Method:      http.MethodPost,
		Path:        "/drafts/{id}/reset",
		Summary:     "Clear every pick and return the board to setup",
		Description: "Chief only. Each applicant goes back to the stage they were in before their pick; the team order is kept, so a rehearsal can be wiped without rebuilding it.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.reset)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-draft",
		Method:        http.MethodDelete,
		Path:          "/drafts/{id}",
		Summary:       "Delete a draft board",
		Description:   "Chief only. Undoes every pick's stage change, then removes the board, its order, and its picks.",
		Tags:          []string{"Draft"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.delete)

	huma.Register(api, huma.Operation{
		OperationID: "list-drafted-applications",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/drafted",
		Summary:     "Which applicants a cycle's drafts have already claimed",
		Description: "Reviewer only. Application id to the team name that took them, for marking them as taken wherever they're still listed.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.drafted)
}

type DraftBoardOutput struct {
	Body models.DraftBoard
}

type DraftOutput struct {
	Body models.Draft
}

type DraftScopedInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role: software_engineer or software_designer"`
}

// parseDraftRole rejects a missing or unknown role rather than silently
// picking one — the two boards are independent and a wrong guess would show
// the other role's picks.
func parseDraftRole(raw string) (models.Role, error) {
	role := models.Role(raw)
	if !role.Valid() {
		return "", huma.Error422UnprocessableEntity("role must be 'software_engineer' or 'software_designer'")
	}
	return role, nil
}

func (h *draftHandler) board(ctx context.Context, in *DraftScopedInput) (*DraftBoardOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	role, err := parseDraftRole(in.Role)
	if err != nil {
		return nil, err
	}
	draft, err := h.store.GetDraft(ctx, in.ID, role)
	if err != nil {
		return nil, storeErr(err)
	}
	board, err := h.store.DraftBoard(ctx, draft)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftBoardOutput{Body: board}, nil
}

type OpenDraftInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role   models.Role `json:"role" doc:"Applicant role: software_engineer or software_designer"`
		Rounds int         `json:"rounds,omitempty" doc:"How many times around the board; defaults to 1" minimum:"0"`
	}
}

func (h *draftHandler) open(ctx context.Context, in *OpenDraftInput) (*DraftOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role must be 'software_engineer' or 'software_designer'")
	}
	rounds := in.Body.Rounds
	if rounds == 0 {
		rounds = 1
	}
	if rounds > maxDraftRounds {
		return nil, huma.Error422UnprocessableEntity("rounds is too large")
	}
	draft, err := h.store.CreateDraft(ctx, in.ID, in.Body.Role, rounds, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftOutput{Body: draft}, nil
}

type UpdateDraftInput struct {
	ID   string `path:"id" doc:"Draft ID"`
	Body struct {
		Status *models.DraftStatus `json:"status,omitempty" doc:"setup, active, or complete"`
		Rounds *int                `json:"rounds,omitempty" doc:"How many times around the board" minimum:"1"`
	}
}

func (h *draftHandler) update(ctx context.Context, in *UpdateDraftInput) (*DraftOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("status must be 'setup', 'active', or 'complete'")
	}
	if in.Body.Rounds != nil && *in.Body.Rounds > maxDraftRounds {
		return nil, huma.Error422UnprocessableEntity("rounds is too large")
	}
	draft, err := h.store.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	// Shrinking the board would orphan picks in the slots it cuts off, so the
	// floor is whatever has already been picked.
	if in.Body.Rounds != nil {
		picks, err := h.store.ListDraftPicks(ctx, draft.ID)
		if err != nil {
			return nil, storeErr(err)
		}
		teams, err := h.store.ListDraftTeams(ctx, draft.ID)
		if err != nil {
			return nil, storeErr(err)
		}
		if len(teams) > 0 {
			highest := 0
			for _, p := range picks {
				if p.PickNumber > highest {
					highest = p.PickNumber
				}
			}
			if *in.Body.Rounds*len(teams) < highest {
				return nil, huma.Error422UnprocessableEntity("rounds would cut off picks already made")
			}
		}
	}
	updated, err := h.store.UpdateDraft(ctx, in.ID, store.DraftUpdate{
		Status: in.Body.Status,
		Rounds: in.Body.Rounds,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftOutput{Body: updated}, nil
}

type SetDraftTeamsInput struct {
	ID   string `path:"id" doc:"Draft ID"`
	Body struct {
		PreferenceListIDs []string `json:"preference_list_ids" doc:"The drafting groups, in the order they pick" minItems:"1" maxItems:"50"`
	}
}

func (h *draftHandler) setTeams(ctx context.Context, in *SetDraftTeamsInput) (*DraftBoardOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	draft, err := h.store.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	// Reordering mid-draft would reassign picks that have already been made to
	// different teams, so the order is frozen once picking starts.
	if draft.Status != models.DraftSetup {
		return nil, huma.Error409Conflict("the draft order can only change while the draft is in setup")
	}
	if err := h.store.SetDraftTeams(ctx, in.ID, in.Body.PreferenceListIDs); err != nil {
		return nil, storeErr(err)
	}
	board, err := h.store.DraftBoard(ctx, draft)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftBoardOutput{Body: board}, nil
}

type MakeDraftPickInput struct {
	ID   string `path:"id" doc:"Draft ID"`
	Body struct {
		ApplicationID string `json:"application_id"`
		PickNumber    int    `json:"pick_number,omitempty" doc:"Which slot to fill; omit for the one on the clock" minimum:"0"`
	}
}

type DraftPickOutput struct {
	Body models.DraftPick
}

func (h *draftHandler) pick(ctx context.Context, in *MakeDraftPickInput) (*DraftPickOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.ApplicationID == "" {
		return nil, huma.Error422UnprocessableEntity("application_id is required")
	}
	draft, err := h.store.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if draft.Status != models.DraftActive {
		return nil, huma.Error409Conflict("the draft isn't active")
	}
	pick, err := h.store.MakeDraftPick(ctx, draft, in.Body.PickNumber, in.Body.ApplicationID, currentActor(ctx).NUID)
	if err != nil {
		if errors.Is(err, store.ErrDraftSlotTaken) {
			return nil, huma.Error409Conflict("that slot has already been filled")
		}
		return nil, storeErr(err)
	}
	return &DraftPickOutput{Body: pick}, nil
}

type RemoveDraftPickInput struct {
	ID         string `path:"id" doc:"Draft ID"`
	PickNumber int    `path:"pick_number" doc:"Which slot to empty" minimum:"1"`
}

func (h *draftHandler) removePick(ctx context.Context, in *RemoveDraftPickInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.RemoveDraftPick(ctx, in.ID, in.PickNumber); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

type DraftIDInput struct {
	ID string `path:"id" doc:"Draft ID"`
}

func (h *draftHandler) reset(ctx context.Context, in *DraftIDInput) (*DraftBoardOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.ResetDraft(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	draft, err := h.store.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	board, err := h.store.DraftBoard(ctx, draft)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftBoardOutput{Body: board}, nil
}

func (h *draftHandler) delete(ctx context.Context, in *DraftIDInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeleteDraft(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

type DraftedApplicationsOutput struct {
	Body map[string]string
}

func (h *draftHandler) drafted(ctx context.Context, in *CycleScopedInput) (*DraftedApplicationsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	taken, err := h.store.DraftedApplicationIDs(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftedApplicationsOutput{Body: taken}, nil
}
