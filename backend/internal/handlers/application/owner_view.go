package application

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// CycleStatuses maps each cycle to its status.
func (a *ApplicationDB) CycleStatuses(ctx context.Context, cycleIDs []string) (map[string]models.CycleStatus, error) {
	var rows []struct {
		ID     string
		Status models.CycleStatus
	}
	err := a.db.WithContext(ctx).Model(&models.Cycle{}).Select("id, status").Where("id IN ?", cycleIDs).Scan(&rows).Error
	out := make(map[string]models.CycleStatus, len(rows))
	for _, r := range rows {
		out[r.ID] = r.Status
	}
	return out, err
}

// ownerView shows an applicant none of the pipeline: staff tags never, and
// only "submitted" until the cycle closes, when the outcome appears.
func (s *applicationService) ownerView(ctx context.Context, apps ...*models.Application) error {
	staff := map[string]bool{}
	var cycles []string
	for _, a := range apps {
		if _, seen := staff[a.CycleID]; seen {
			continue
		}
		c, err := s.access.Cycle(ctx, a.CycleID)
		if err != nil {
			return err
		}
		staff[a.CycleID] = c.Allows(access.ReviewCycle)
		cycles = append(cycles, a.CycleID)
	}
	if len(cycles) == 0 {
		return nil
	}
	statuses, err := s.applicationDB.CycleStatuses(ctx, cycles)
	if err != nil {
		return err
	}
	for _, a := range apps {
		if staff[a.CycleID] {
			continue
		}
		a.TagIDs = []string{}
		switch a.Stage {
		case models.StageDraft, models.StageWithdrawn:
		case models.StageAccepted, models.StageRejected:
			if st := statuses[a.CycleID]; st != models.CycleClosed && st != models.CycleArchived {
				a.Stage = models.StageSubmitted
			}
		default:
			a.Stage = models.StageSubmitted
		}
	}
	return nil
}

// staffOnlyFilters are the filters an applicant listing their own
// applications can't use, since each would answer a question about hidden data.
func staffOnlyFilters(in *ListApplicationsInput) error {
	for _, v := range []string{in.AssignedTo, in.InterviewerNUID, in.RecordingReviewerNUID, in.RatingFilters,
		in.TagIDs, in.AnswerFilters, in.Stage, in.Stages, in.Returner, in.Search} {
		if v != "" {
			return huma.Error422UnprocessableEntity("only cycle_id and role filters apply to your own applications")
		}
	}
	return nil
}
