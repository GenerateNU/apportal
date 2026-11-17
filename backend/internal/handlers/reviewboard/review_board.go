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
	Body []BoardRow
}

var boardStages = []models.ApplicationStage{models.StageSubmitted, models.StageLeadReview, models.StageChiefReview}

type ReviewBoardInput struct {
	ID string `path:"id" doc:"Cycle ID"`
	// History keeps everyone who was reviewed, after they move on or are turned down.
	History bool `query:"history" doc:"Also list everyone with reviewers assigned, whatever their stage now"`
}

func (s *reviewService) reviewBoard(ctx context.Context, in *ReviewBoardInput) (*ReviewBoardOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	stages := boardStages
	if in.History {
		stages = nil
	}
	apps, err := s.store.Applications(ctx, in.ID, stages)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	reviewers, err := s.store.Reviewers(ctx, in.ID, stages)
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
	return &ReviewBoardOutput{Body: board}, nil
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
