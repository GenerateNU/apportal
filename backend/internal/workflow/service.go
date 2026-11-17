package workflow

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func (s *Service) as(ctx context.Context, cycleID string) (*gorm.DB, Caller, error) {
	db := s.db.WithContext(ctx)
	c, err := CallerOn(ctx, db, cycleID)
	return db, c, err
}

func (s *Service) State(ctx context.Context, cycleID string) (*CycleState, error) {
	return Load(s.db.WithContext(ctx), cycleID)
}

func (s *Service) Overview(ctx context.Context, cycleID string) (Overview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return Overview{}, err
	}
	return loadOverview(db, cycleID, c, s.now())
}

func (s *Service) ReviewGates(ctx context.Context, cycleID string) ([]models.ReviewGate, error) {
	return loadReviewGates(s.db.WithContext(ctx), cycleID)
}

func (s *Service) ReviewsIn(ctx context.Context, cycleID, roleID string) (bool, error) {
	return reviewsIn(s.db.WithContext(ctx), cycleID, roleID, s.now())
}

func (s *Service) SetStepEnabled(ctx context.Context, cycleID string, step models.Step, enabled bool) (Preview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return Preview{}, err
	}
	return setStepEnabled(db, cycleID, step, enabled, c)
}

func (s *Service) SetAssignment(ctx context.Context, cycleID string, step models.Step, k models.StepKind, perApplicant *int) (Preview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return Preview{}, err
	}
	return setAssignment(db, cycleID, step, k, perApplicant, c)
}

func (s *Service) SetDeadline(ctx context.Context, in DeadlineInput) (Preview, error) {
	db, c, err := s.as(ctx, in.CycleID)
	if err != nil {
		return Preview{}, err
	}
	in.Caller, in.Now = c, s.now()
	return setDeadline(db, in)
}

func (s *Service) ClearDeadline(ctx context.Context, cycleID, roleID string, step models.Step, k models.StepKind) (Preview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return Preview{}, err
	}
	return clearDeadline(db, cycleID, roleID, step, k, c, s.now())
}

func (s *Service) Release(ctx context.Context, cycleID, roleID string, step models.Step) (Preview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return Preview{}, err
	}
	return release(db, cycleID, roleID, step, c, s.now())
}

func (s *Service) Unrelease(ctx context.Context, cycleID, roleID string, step models.Step) (Preview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return Preview{}, err
	}
	return unrelease(db, cycleID, roleID, step, c)
}

func (s *Service) SetPeerRelease(ctx context.Context, cycleID, roleID string, k models.ReviewKind, released bool) (Preview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return Preview{}, err
	}
	return setPeerRelease(db, cycleID, roleID, k, released, c)
}

func (s *Service) Complete(ctx context.Context, cycleID string, step models.Step) error {
	return complete(s.db.WithContext(ctx), cycleID, step, s.now())
}

func (s *Service) Advance(ctx context.Context, in AdvanceInput) ([]string, Preview, error) {
	db, c, err := s.as(ctx, in.CycleID)
	if err != nil {
		return nil, Preview{}, err
	}
	in.Caller = c
	return advance(db, in, s.now())
}

func (s *Service) Undo(ctx context.Context, cycleID string, step models.Step, roleID string) ([]string, Preview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return nil, Preview{}, err
	}
	return undo(db, cycleID, step, roleID, c, s.now())
}

func (s *Service) CloseCycle(ctx context.Context, cycleID string) (models.Cycle, Preview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return models.Cycle{}, Preview{}, err
	}
	return closeCycle(db, cycleID, c)
}

func (s *Service) Decide(ctx context.Context, cycleID, roleID string, accepted []string) ([]string, Preview, error) {
	db, c, err := s.as(ctx, cycleID)
	if err != nil {
		return nil, Preview{}, err
	}
	return decide(db, cycleID, roleID, accepted, c, s.now())
}
