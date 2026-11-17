package applicationsummary

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type SummaryInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

type PositionSummary struct {
	RoleID    string     `json:"role_id"`
	RoleName  string     `json:"role_name"`
	Submitted int        `json:"submitted"`
	NewDay    int        `json:"new_day" doc:"Submitted in the last 24 hours"`
	NewWeek   int        `json:"new_week" doc:"Submitted in the last 7 days"`
	ClosesAt  *time.Time `json:"closes_at,omitempty"`
}

type SummaryOutput struct {
	Body struct {
		Positions []PositionSummary `json:"positions"`
	}
}

type service struct {
	access *access.Checker
	db     *gorm.DB
	now    func() time.Time
}

func Route(api huma.API, db *gorm.DB) {
	s := &service{access: access.NewChecker(db), db: db, now: time.Now}
	huma.Register(api, huma.Operation{
		OperationID: "get-application-summary",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/application-summary",
		Summary:     "How applications are going, per position",
		Description: "Chiefs and admins. How many have applied, recent submissions, and the deadline.",
		Tags:        []string{"Applications"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.get)
}

func (s *service) get(ctx context.Context, in *SummaryInput) (*SummaryOutput, error) {
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	positions, err := summarize(s.db.WithContext(ctx), in.ID, s.now())
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &SummaryOutput{}
	out.Body.Positions = positions
	return out, nil
}

func summarize(db *gorm.DB, cycleID string, now time.Time) ([]PositionSummary, error) {
	f, err := workflow.Load(db, cycleID)
	if err != nil {
		return nil, err
	}
	var rows []struct {
		RoleID                     string
		Submitted, NewDay, NewWeek int
	}
	if err := db.Model(&models.Application{}).
		Select(`role_id,
			count(*) FILTER (WHERE stage <> ?) AS submitted,
			count(*) FILTER (WHERE stage <> ? AND submitted_at > ?) AS new_day,
			count(*) FILTER (WHERE stage <> ? AND submitted_at > ?) AS new_week`,
			models.StageDraft, models.StageDraft, now.Add(-24*time.Hour), models.StageDraft, now.Add(-7*24*time.Hour)).
		Where("cycle_id = ?", cycleID).Group("role_id").Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]PositionSummary, 0, len(f.Openings))
	for _, o := range f.Openings {
		p := PositionSummary{RoleID: o.RoleID, RoleName: o.Name}
		for _, r := range rows {
			if r.RoleID == o.RoleID {
				p.Submitted, p.NewDay, p.NewWeek = r.Submitted, r.NewDay, r.NewWeek
			}
		}
		if d, ok := f.Deadline(o.RoleID, models.StepApplications, models.KindApplicant); ok {
			p.ClosesAt = &d.DueAt
		}
		out = append(out, p)
	}
	return out, nil
}
