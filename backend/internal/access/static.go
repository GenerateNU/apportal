package access

import (
	"context"
	"slices"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type Static struct {
	Cycles       map[string]StaticCycle
	Applications map[string]StaticApplication
}

type StaticCycle struct {
	Status models.CycleStatus
	Type   models.ApplicationType
	Staff  map[string]models.CycleStaffRole
}

type StaticApplication struct {
	CycleID            string
	Owner              string
	Stage              models.ApplicationStage
	Interviewers       []string
	RecordingReviewers []string
}

func (s Static) Cycle(ctx context.Context, cycleID string) (CycleAccess, error) {
	actor, err := currentActor(ctx)
	if err != nil {
		return CycleAccess{}, err
	}
	c, ok := s.Cycles[cycleID]
	if !ok {
		return CycleAccess{}, nil
	}
	return CycleAccess{level: s.level(c, actor.NUID, IsAdmin(actor))}, nil
}

func (s Static) level(c StaticCycle, nuid string, admin bool) Level {
	return LevelFor(admin, c.Staff[nuid], c.Status, c.Type)
}

func (s Static) CanCycle(ctx context.Context, action CycleAction, cycleID string) error {
	a, err := s.Cycle(ctx, cycleID)
	if err != nil {
		return err
	}
	return a.Can(action)
}

func (s Static) Application(ctx context.Context, applicationID string) (ApplicationAccess, error) {
	actor, err := currentActor(ctx)
	if err != nil {
		return ApplicationAccess{}, err
	}
	app, ok := s.Applications[applicationID]
	if !ok {
		return ApplicationAccess{}, nil
	}
	return ApplicationAccess{
		level:             s.level(s.Cycles[app.CycleID], actor.NUID, IsAdmin(actor)),
		owner:             app.Owner == actor.NUID,
		draft:             app.Stage == models.StageDraft,
		interviewer:       slices.Contains(app.Interviewers, actor.NUID),
		recordingReviewer: slices.Contains(app.RecordingReviewers, actor.NUID),
	}, nil
}

func (s Static) CanApplication(ctx context.Context, action ApplicationAction, applicationID string) error {
	a, err := s.Application(ctx, applicationID)
	if err != nil {
		return err
	}
	return a.Can(action)
}
