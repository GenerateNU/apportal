package reviewquestion

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"

	"github.com/GenerateNU/apportal/backend/internal/access"

	"github.com/GenerateNU/apportal/backend/internal/handlers/cyclestaff"
)

// reviewQuestionAverageService exposes, per lead, their average score on each
// review question for a cycle × role — a calibration check for whether a
// lead scores certain questions systematically higher or lower than their
// peers (as opposed to reviewerProgressHandler's submission-status view).
type reviewQuestionAverageService struct {
	access           *access.Checker
	reviewQuestionDB *ReviewQuestionDB
	staffDB          *cyclestaff.CycleStaffDB
}

func (s *reviewQuestionAverageService) list(ctx context.Context, in *ReviewQuestionAverageInput) (*ReviewQuestionAverageOutput, error) {
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}

	rows, err := s.reviewQuestionDB.ListReviewQuestionAverages(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	leads, err := s.staffDB.ListStaff(ctx, in.ID, models.CycleStaffLead)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	byLead := make(map[string]*models.ReviewQuestionAverage, len(leads))
	order := make([]string, 0, len(leads))
	for _, lead := range leads {
		byLead[lead.UserNUID] = &models.ReviewQuestionAverage{
			LeadNUID: lead.UserNUID,
			FullName: lead.FullName,
			Scores:   []models.QuestionAverageScore{},
		}
		order = append(order, lead.UserNUID)
	}

	for _, r := range rows {
		p, ok := byLead[r.LeadNUID]
		if !ok {
			// A scored review from someone no longer a lead on this cycle:
			// still surface it rather than silently dropping the data.
			p = &models.ReviewQuestionAverage{LeadNUID: r.LeadNUID, Scores: []models.QuestionAverageScore{}}
			byLead[r.LeadNUID] = p
			order = append(order, r.LeadNUID)
		}
		p.Scores = append(p.Scores, models.QuestionAverageScore{
			ReviewQuestionID: r.ReviewQuestionID,
			AvgScore:         r.AvgScore,
			Count:            r.Count,
		})
	}

	out := make([]models.ReviewQuestionAverage, 0, len(order))
	for _, nuid := range order {
		out = append(out, *byLead[nuid])
	}
	return &ReviewQuestionAverageOutput{Body: out}, nil
}
