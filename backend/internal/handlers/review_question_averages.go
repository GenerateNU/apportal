package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// reviewQuestionAverageHandler exposes, per lead, their average score on each
// review question for a cycle × role — a calibration check for whether a
// lead scores certain questions systematically higher or lower than their
// peers (as opposed to reviewerProgressHandler's submission-status view).
type reviewQuestionAverageHandler struct {
	store *store.Store
}

func (h *reviewQuestionAverageHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-review-question-averages",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-question-averages",
		Summary:     "Per-lead average score on each review question for a cycle",
		Description: "Chief only. One entry per lead with a role='lead' account, " +
			"listing their average score on each of the cycle/role's score-type " +
			"review questions.",
		Tags:   []string{"Review releases"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.list)
}

type ReviewQuestionAverageInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type ReviewQuestionAverageOutput struct {
	Body []models.ReviewQuestionAverage
}

func (h *reviewQuestionAverageHandler) list(ctx context.Context, in *ReviewQuestionAverageInput) (*ReviewQuestionAverageOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	rows, err := h.store.ListReviewQuestionAverages(ctx, in.ID, in.Role)
	if err != nil {
		return nil, storeErr(err)
	}

	leadRole := models.UserRoleLead
	leads, _, err := h.store.ListUsers(ctx, &leadRole, nil, 0)
	if err != nil {
		return nil, storeErr(err)
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
