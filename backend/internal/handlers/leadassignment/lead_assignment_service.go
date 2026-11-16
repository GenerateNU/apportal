package leadassignment

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/reviewrules"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type leadAssignmentService struct {
	access applicationGate
	store  manualStore
	rules  reviewrules.Rules
}

func errReleased() error {
	return huma.Error409Conflict("Reviews are already out for this opening, so reviewers can't be removed.")
}

func parseID(id, name string) error {
	if _, err := uuid.Parse(id); err != nil {
		return huma.Error422UnprocessableEntity("invalid " + name)
	}
	return nil
}

func statusErr(err error) error {
	var se huma.StatusError
	if errors.As(err, &se) {
		return err
	}
	return utils.StoreErr(err)
}

func (s *leadAssignmentService) create(ctx context.Context, in *CreateLeadAssignmentInput) (*LeadAssignmentOutput, error) {
	if err := access.RequireActor(ctx); err != nil {
		return nil, err
	}
	if err := parseID(in.ID, "application id"); err != nil {
		return nil, err
	}
	if err := s.access.CanApplication(ctx, access.ManageApplication, in.ID); err != nil {
		return nil, err
	}
	if in.Body.LeadNUID == "" {
		return nil, huma.Error422UnprocessableEntity("lead_nuid is required")
	}
	o, err := s.store.ApplicationOpening(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if step, _ := pipeline.StepOfStage(o.Stage); step != models.StepApplications && step != models.StepReviews {
		return nil, huma.Error409Conflict("reviewers can only be assigned while an application is submitted or in review")
	}
	if err := s.writable(ctx, o); err != nil {
		return nil, err
	}
	eligible, err := s.rules.Eligible(ctx, o.CycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !slices.Contains(eligible[o.RoleID], in.Body.LeadNUID) {
		return nil, huma.Error422UnprocessableEntity("lead_nuid can't review this opening")
	}
	perApplicant, err := s.rules.PerApplicant(ctx, o.CycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if perApplicant <= 0 {
		return nil, reviewrules.ErrNoPerApplicant()
	}

	var out models.LeadAssignment
	err = s.store.Locked(ctx, o.CycleID, func(tx manualStore) error {
		conflicted, err := tx.Conflicted(ctx, in.ID, in.Body.LeadNUID)
		if err != nil {
			return err
		}
		if conflicted {
			return huma.Error409Conflict("This reviewer has a conflict of interest with this applicant.")
		}
		n, err := tx.CountAssignments(ctx, in.ID)
		if err != nil {
			return err
		}
		if n >= perApplicant {
			return huma.Error409Conflict(fmt.Sprintf("This applicant already has %d reviewers, the most each applicant gets.", n))
		}
		out, err = tx.Create(ctx, in.ID, in.Body.LeadNUID, utils.CurrentActor(ctx).NUID)
		if errors.Is(err, utils.ErrConflict) {
			return huma.Error409Conflict("This reviewer is already assigned to this applicant.")
		}
		return err
	})
	if err != nil {
		return nil, statusErr(err)
	}
	return &LeadAssignmentOutput{Body: out}, nil
}

func (s *leadAssignmentService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*LeadAssignmentsOutput, error) {
	if err := access.RequireActor(ctx); err != nil {
		return nil, err
	}
	if err := parseID(in.ID, "application id"); err != nil {
		return nil, err
	}
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	items, err := s.store.List(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &LeadAssignmentsOutput{Body: items}, nil
}

func (s *leadAssignmentService) delete(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := access.RequireActor(ctx); err != nil {
		return nil, err
	}
	if err := parseID(in.ID, "assignment id"); err != nil {
		return nil, err
	}
	if err := s.access.CanApplicationOf(ctx, access.ManageApplication, "lead_assignments", in.ID); err != nil {
		return nil, err
	}
	o, err := s.store.AssignmentOpening(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if err := s.removable(ctx, o); err != nil {
		return nil, err
	}
	if err := s.store.Delete(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *leadAssignmentService) deleteAll(ctx context.Context, in *DeleteAllLeadAssignmentsInput) (*DeleteAllLeadAssignmentsOutput, error) {
	if err := access.RequireActor(ctx); err != nil {
		return nil, err
	}
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if err := parseID(in.ID, "cycle id"); err != nil {
		return nil, err
	}
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	ok, err := s.store.RoleInCycle(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !ok {
		return nil, huma.Error422UnprocessableEntity("role_id isn't an opening on this cycle")
	}
	if err := s.removable(ctx, opening{CycleID: in.ID, RoleID: in.RoleID}); err != nil {
		return nil, err
	}
	deleted, err := s.store.DeleteUnsubmitted(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &DeleteAllLeadAssignmentsOutput{}
	out.Body.Deleted = deleted
	return out, nil
}

func (s *leadAssignmentService) writable(ctx context.Context, o opening) error {
	frozen, err := s.rules.Frozen(ctx, o.CycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	if frozen[o.RoleID] {
		return reviewrules.ErrFrozen()
	}
	return nil
}

func (s *leadAssignmentService) removable(ctx context.Context, o opening) error {
	released, err := s.rules.Released(ctx, o.CycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	if released[o.RoleID] {
		return errReleased()
	}
	return s.writable(ctx, o)
}
