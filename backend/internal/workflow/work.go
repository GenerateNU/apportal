package workflow

import (
	"context"
	"fmt"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type Work string

const (
	WorkApplication         Work = "application"
	WorkReviewAssignment    Work = "review_assignment"
	WorkWrittenReview       Work = "written_review"
	WorkChiefReview         Work = "chief_review"
	WorkShortlist           Work = "shortlist"
	WorkInterviewSchedule   Work = "interview_schedule"
	WorkInterviewAssignment Work = "interview_assignment"
	WorkInterview           Work = "interview"
	WorkRecordingReview     Work = "recording_review"
	WorkSelection           Work = "selection"
	WorkPreferenceList      Work = "preference_list"
	WorkDraft               Work = "draft"
)

// Setup is what chiefs prepare for a step before it is released.
const (
	SetupApplicationForm    Work = "application_form"
	SetupReviewRubric       Work = "review_rubric"
	SetupInterviewScript    Work = "interview_script"
	SetupInterviewLogistics Work = "interview_logistics"
	SetupDecisionLetters    Work = "decision_letters"
	SetupReviewTeam         Work = "review_team"
	SetupInterviewTeam      Work = "interview_team"
)

type workRule struct {
	step     models.Step
	deadline models.StepKind
}

// works maps each kind of work to the step that owns it; the work locks once that step's next step starts.
var works = map[Work]workRule{
	WorkApplication:         {models.StepApplications, models.KindApplicant},
	WorkReviewAssignment:    {models.StepReviews, ""},
	WorkWrittenReview:       {models.StepReviews, models.KindReviewer},
	WorkChiefReview:         {models.StepReviews, ""},
	WorkShortlist:           {models.StepReviews, ""},
	WorkInterviewSchedule:   {models.StepInterviews, ""},
	WorkInterviewAssignment: {models.StepInterviews, ""},
	WorkInterview:           {models.StepInterviews, models.KindInterviewer},
	WorkRecordingReview:     {models.StepInterviews, models.KindRecordingReviewer},
	WorkSelection:           {models.StepDecisions, ""},
	WorkPreferenceList:      {models.StepDecisions, models.KindPreferenceList},
	WorkDraft:               {models.StepDecisions, ""},

	SetupApplicationForm:    {models.StepApplications, ""},
	SetupReviewRubric:       {models.StepReviews, ""},
	SetupInterviewScript:    {models.StepInterviews, ""},
	SetupInterviewLogistics: {models.StepInterviews, ""},
	SetupDecisionLetters:    {models.StepFeedback, ""},
	SetupReviewTeam:         {models.StepReviews, ""},
	SetupInterviewTeam:      {models.StepInterviews, ""},
}

func StepOf(w Work) models.Step { return works[w].step }

func (s *Service) RequireWorkEditable(ctx context.Context, applicationID string, w Work) error {
	r := works[w]
	return checkApplicationSubmission(ctx, s.db.WithContext(ctx), applicationID, r.step, r.deadline, s.now())
}

func (s *Service) RequireOpeningWorkEditable(ctx context.Context, cycleID, roleID string, w Work) error {
	r := works[w]
	db := s.db.WithContext(ctx)
	caller, err := CallerOn(ctx, db, cycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	return checkSubmission(ctx, db, cycleID, roleID, r.step, r.deadline, caller, s.now())
}

func (s *Service) RequireAnyOpeningWorkEditable(ctx context.Context, cycleID string, w Work) error {
	r := works[w]
	db := s.db.WithContext(ctx)
	f, err := Load(db, cycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	if err := f.RequireStepRun(r.step); err != nil {
		return err
	}
	caller, err := CallerOn(ctx, db, cycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	var locked error
	var override *Operation
	for _, o := range f.Openings {
		op, err := f.submitOp(o.RoleID, r.step, r.deadline, caller, s.now())
		if err == nil {
			err = f.EnforcePermission(op)
		}
		switch {
		case err != nil:
			locked = err
		case f.CheckPermission(op).Level == LevelNormal:
			return nil
		case override == nil:
			override = &op
		}
	}
	if override != nil {
		return authorizeOnSuccess(ctx, db, f, *override)
	}
	return locked
}

// VisibleApplications keeps the applications whose cycle runs the step that owns w; a step with no row yet is on by default.
func (s *Service) VisibleApplications(ctx context.Context, applicationIDs []string, w Work) ([]string, error) {
	if len(applicationIDs) == 0 {
		return []string{}, nil
	}
	var ids []string
	err := s.db.WithContext(ctx).Table("applications a").
		Joins("LEFT JOIN cycle_steps cs ON cs.cycle_id = a.cycle_id AND cs.step = ?", StepOf(w)).
		Where("a.id IN ? AND COALESCE(cs.enabled, TRUE)", applicationIDs).
		Pluck("a.id", &ids).Error
	return ids, err
}

func (s *Service) WorkVisible(ctx context.Context, applicationID string, w Work) (bool, error) {
	ids, err := s.VisibleApplications(ctx, []string{applicationID}, w)
	return len(ids) > 0, err
}

// AssignmentPermission covers adding or removing someone on work for an opening: once its step is
// released, adding needs a confirmed override and removing is destructive, since it can drop unfinished work.
func (f *CycleState) AssignmentPermission(c Caller, w Work, roleID string, remove bool) error {
	return f.EnforcePermission(f.AssignmentOp(c, w, roleID, remove))
}

func (f *CycleState) AssignmentOp(c Caller, w Work, roleID string, remove bool) Operation {
	step := StepOf(w)
	op := c.operation(OpAssign, step, roleID)
	if f.Released(roleID, step) {
		op.Level, op.Reason = LevelOverride, fmt.Sprintf("%s is released for %s", Label(step), f.RoleName(roleID))
		if remove {
			op.Level, op.Reason = LevelDestructive, op.Reason+"; removing someone drops their unfinished work"
		}
	}
	return op
}

func (s *Service) RequireAssignmentChange(ctx context.Context, cycleID, roleID string, w Work, remove bool) error {
	db := s.db.WithContext(ctx)
	f, err := Load(db, cycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	caller, err := CallerOn(ctx, db, cycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	return authorizeOnSuccess(ctx, db, f, f.AssignmentOp(caller, w, roleID, remove))
}

func (s *Service) AssignmentPermissions(ctx context.Context, cycleID string, w Work) (map[string]error, error) {
	db := s.db.WithContext(ctx)
	f, err := Load(db, cycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	caller, err := CallerOn(ctx, db, cycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := make(map[string]error, len(f.Openings))
	for _, o := range f.Openings {
		out[o.RoleID] = f.AssignmentPermission(caller, w, o.RoleID, false)
	}
	return out, nil
}

// RequireSetupEditable lets chiefs edit a step's setup freely until it is released for an opening (any opening when roleID
// is empty); after that people may have seen it, so an edit is an override. A step the cycle doesn't run has no setup.
func (s *Service) RequireSetupEditable(ctx context.Context, cycleID, roleID string, w Work) error {
	db := s.db.WithContext(ctx)
	f, err := Load(db, cycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	caller, err := CallerOn(ctx, db, cycleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	ops, err := f.setupOps(caller, w, roleID)
	if err != nil {
		return err
	}
	return authorizeOnSuccess(ctx, db, f, ops...)
}

func (f *CycleState) setupOps(c Caller, w Work, roleID string) ([]Operation, error) {
	step := StepOf(w)
	if err := f.RequireStepRun(step); err != nil {
		return nil, err
	}
	roles := []string{roleID}
	if roleID == "" {
		roles = roles[:0]
		for _, o := range f.Openings {
			roles = append(roles, o.RoleID)
		}
	}
	ops := make([]Operation, 0, len(roles))
	for _, r := range roles {
		op := c.operation(OpEditSetup, step, r)
		if f.Released(r, step) {
			op.Level, op.Reason = LevelOverride, fmt.Sprintf("%s is already released for %s, so people may have seen this", Label(step), f.RoleName(r))
		}
		ops = append(ops, op)
	}
	return ops, nil
}

func (s *Service) RequireSetupVisible(ctx context.Context, cycleID string, w Work) error {
	var off int64
	err := s.db.WithContext(ctx).Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ? AND NOT enabled", cycleID, StepOf(w)).Count(&off).Error
	if err != nil {
		return utils.StoreErr(err)
	}
	if off > 0 {
		return huma.Error404NotFound(fmt.Sprintf("this cycle doesn't run %s", Label(StepOf(w))))
	}
	return nil
}
