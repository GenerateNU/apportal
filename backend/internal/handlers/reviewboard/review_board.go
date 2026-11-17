package reviewboard

import (
	"context"
	"slices"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type BoardReviewer struct {
	AssignmentID string `json:"assignment_id"`
	LeadNUID     string `json:"lead_nuid"`
	FullName     string `json:"full_name"`
	Started      bool   `json:"started" doc:"Has a review, submitted or not"`
	Submitted    bool   `json:"submitted"`
}

type BoardRow struct {
	ApplicationID string                  `json:"application_id"`
	ApplicantNUID string                  `json:"applicant_nuid"`
	FullName      string                  `json:"full_name"`
	Email         string                  `json:"email"`
	RoleID        string                  `json:"role_id"`
	Stage         models.ApplicationStage `json:"stage"`
	SubmittedAt   *time.Time              `json:"submitted_at,omitempty"`
	Returner      bool                    `json:"returner"`
	Reviewers     []BoardReviewer         `json:"reviewers"`
}

type ReviewBoardOutput struct {
	Body struct {
		Rows       []BoardRow `json:"rows"`
		NextCursor string     `json:"next_cursor,omitempty"`
	}
}

var boardStages = []models.ApplicationStage{models.StageSubmitted, models.StageLeadReview, models.StageChiefReview}

type ReviewBoardInput struct {
	ID string `path:"id" doc:"Cycle ID"`
	// History keeps everyone who was reviewed, after they move on or are turned down.
	History bool   `query:"history" doc:"Also list everyone with reviewers assigned, whatever their stage now"`
	Limit   int    `query:"limit" doc:"Max rows per page; omit (or 0) to return every match" minimum:"0" maximum:"200"`
	Cursor  string `query:"cursor" doc:"next_cursor from the previous page; omit for the first page"`
}

func (s *reviewService) reviewBoard(ctx context.Context, in *ReviewBoardInput) (*ReviewBoardOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	after, err := utils.ParseCursor(in.Cursor)
	if err != nil {
		return nil, err
	}
	stages := boardStages
	if in.History {
		stages = nil
	}
	out := &ReviewBoardOutput{}
	apps, next, err := s.store.ApplicationsPage(ctx, in.ID, stages, in.Limit, after)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	var reviewers []assignedReviewer
	if in.Limit > 0 {
		ids := make([]string, len(apps))
		for i, a := range apps {
			ids[i] = a.ID
		}
		reviewers, err = s.store.ReviewersFor(ctx, ids)
	} else {
		reviewers, err = s.store.Reviewers(ctx, in.ID, stages)
	}
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	board := buildBoard(apps, reviewers)
	if in.History {
		kept := board[:0]
		for _, r := range board {
			if len(r.Reviewers) > 0 || slices.Contains(boardStages, r.Stage) {
				kept = append(kept, r)
			}
		}
		board = kept
	}
	out.Body.Rows, out.Body.NextCursor = board, next
	return out, nil
}

func buildBoard(apps []models.ApplicationSummary, reviewers []assignedReviewer) []BoardRow {
	byApp := map[string][]BoardReviewer{}
	for _, r := range reviewers {
		byApp[r.ApplicationID] = append(byApp[r.ApplicationID], BoardReviewer{
			AssignmentID: r.ID, LeadNUID: r.LeadNUID, FullName: r.FullName, Started: r.Started, Submitted: r.Submitted,
		})
	}
	out := make([]BoardRow, len(apps))
	for i, a := range apps {
		rs := byApp[a.ID]
		if rs == nil {
			rs = []BoardReviewer{}
		}
		out[i] = BoardRow{
			ApplicationID: a.ID, ApplicantNUID: a.UserNUID, FullName: a.FullName, Email: a.Email, RoleID: a.RoleID,
			Stage: a.Stage, SubmittedAt: a.SubmittedAt, Returner: a.Returner, Reviewers: rs,
		}
	}
	return out
}
