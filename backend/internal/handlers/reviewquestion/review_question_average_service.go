package reviewquestion

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

// reviewQuestionAverageService exposes, per lead, their average score on each
// review question for a cycle × role — a calibration check for whether a
// lead scores certain questions systematically higher or lower than their
// peers (as opposed to reviewerProgressHandler's submission-status view).
type reviewQuestionAverageService struct {
	reviewQuestionDB *ReviewQuestionDB
	userDB           *user.UserDB
}

func (s *reviewQuestionAverageService) list(ctx context.Context, in *ReviewQuestionAverageInput) (*ReviewQuestionAverageOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	rows, err := s.reviewQuestionDB.ListReviewQuestionAverages(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	leadRole := models.UserRoleLead
	leads, _, err := s.userDB.ListUsers(ctx, &leadRole, nil, 0)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	byLead := make(map[string]*models.ReviewQuestionAverage, len(leads))
	order := make([]string, 0, len(leads))
	for _, lead := range leads {
		byLead[lead.NUID] = &models.ReviewQuestionAverage{
			LeadNUID: lead.NUID,
			FullName: lead.FullName,
			Scores:   []models.QuestionAverageScore{},
		}
		order = append(order, lead.NUID)
	}

	for _, r := range rows {
		p, ok := byLead[r.LeadNUID]
		if !ok {
			// A scored review from a lead who no longer holds the lead role:
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
