package interviewboard

import (
	"context"
	"errors"
	"slices"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewpanel"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type interviewBoardService struct {
	gate  access.Gate
	db    *gorm.DB
	guard *staffing.Guard
}

func newService(gate access.Gate, db *gorm.DB) *interviewBoardService {
	return &interviewBoardService{gate: gate, db: db, guard: staffing.NewGuard()}
}

func (s *interviewBoardService) board(ctx context.Context, in *BoardInput) (*BoardOutput, error) {
	if err := utils.RequireUUIDs("cycle id", in.ID); err != nil {
		return nil, err
	}
	if in.RoleID != "" {
		if err := role.ParseRoleID(in.RoleID); err != nil {
			return nil, err
		}
	}
	if err := s.gate.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	after, err := utils.ParseCursor(in.Cursor)
	if err != nil {
		return nil, err
	}
	db := s.db.WithContext(ctx)
	rows, next, err := boardApplicants(db, in.ID, in.RoleID, in.History, in.Limit, after)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &BoardOutput{}
	out.Body.Rows, out.Body.NextCursor = rows, next
	if len(rows) == 0 {
		return out, nil
	}
	ids := make([]string, len(rows))
	for i, r := range rows {
		ids[i] = r.ApplicationID
	}
	interviewers, err := boardPeople(db, "interviewers", "interviewer_nuid", "FALSE", ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	reviewers, err := boardPeople(db, "interview_reviewers", "reviewer_nuid", "x.writeup_submitted_at IS NOT NULL", ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	states, err := interviewStates(db, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	slots, err := applicationSlots(db, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	for i := range rows {
		r := &rows[i]
		st := states[r.ApplicationID]
		r.ScheduledAt, r.Started, r.Done = st.ScheduledAt, st.Started, st.Done
		r.Interviewers = orEmpty(interviewers[r.ApplicationID])
		for j := range r.Interviewers {
			r.Interviewers[j].Done = st.Done
		}
		r.RecordingReviewers = orEmpty(reviewers[r.ApplicationID])
		r.SlotIDs = slots[r.ApplicationID]
		if r.SlotIDs == nil {
			r.SlotIDs = []string{}
		}
	}
	return out, nil
}

func orEmpty(p []InterviewBoardPerson) []InterviewBoardPerson {
	if p == nil {
		return []InterviewBoardPerson{}
	}
	return p
}

func (s *interviewBoardService) autoPlan(ctx context.Context, in *AutoPlanInput) (*AutoPlanOutput, error) {
	if err := utils.RequireUUIDs("cycle id", in.ID); err != nil {
		return nil, err
	}
	roleIDs, err := utils.UUIDList("role_ids", in.Body.RoleIDs)
	if err != nil {
		return nil, err
	}
	if len(roleIDs) > maxRoles {
		return nil, huma.Error422UnprocessableEntity("too many role_ids")
	}
	if err := s.gate.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	dryRun := middleware.IntentFrom(ctx).DryRun
	var plan InterviewPlan
	run := func(tx *gorm.DB) error {
		var snap staffing.Snapshot
		var err error
		plan, snap, err = s.plan(ctx, tx, in.ID, roleIDs, in, !dryRun)
		if err != nil || dryRun {
			return err
		}
		for _, k := range plannedOpenings(snap, plan) {
			if err := snap.Authorize(tx, k.roleID, k.kind, false); err != nil {
				return err
			}
		}
		return save(ctx, tx, plan, utils.CurrentActor(ctx).NUID)
	}
	if dryRun {
		err = run(s.db.WithContext(ctx))
	} else {
		err = s.db.WithContext(ctx).Transaction(run)
	}
	if err != nil {
		var se huma.StatusError
		if errors.As(err, &se) {
			return nil, err
		}
		return nil, utils.StoreErr(err)
	}
	plan.Saved = !dryRun
	return &AutoPlanOutput{Body: plan}, nil
}

type plannedOpening struct {
	roleID string
	kind   models.StepKind
}

func plannedOpenings(snap staffing.Snapshot, plan InterviewPlan) []plannedOpening {
	seen := map[plannedOpening]bool{}
	var out []plannedOpening
	for _, p := range append(slices.Clone(plan.Interviewers), plan.RecordingReviewers...) {
		a, ok := snap.Applicants[p.ApplicationID]
		if k := (plannedOpening{a.RoleID, p.Kind}); ok && !seen[k] {
			seen[k] = true
			out = append(out, k)
		}
	}
	return out
}

func (s *interviewBoardService) plan(ctx context.Context, db *gorm.DB, cycleID string, roleIDs []string, in *AutoPlanInput, lock bool) (InterviewPlan, staffing.Snapshot, error) {
	all, err := cycleRoles(db, cycleID)
	if err != nil {
		return InterviewPlan{}, staffing.Snapshot{}, err
	}
	for _, r := range roleIDs {
		if !slices.Contains(all, r) {
			return InterviewPlan{}, staffing.Snapshot{}, huma.Error422UnprocessableEntity("role_ids must be roles in this cycle")
		}
	}
	if len(roleIDs) == 0 {
		roleIDs = all
	}
	ids, err := plannableIDs(db, cycleID)
	if err != nil {
		return InterviewPlan{}, staffing.Snapshot{}, err
	}
	if lock {
		if err := staffing.Hold(db, cycleID, ids); err != nil {
			return InterviewPlan{}, staffing.Snapshot{}, err
		}
	}
	snap, err := s.guard.Load(ctx, db, cycleID, ids)
	if err != nil {
		return InterviewPlan{}, staffing.Snapshot{}, err
	}
	if err := snap.RequireLimit(models.KindInterviewer); err != nil {
		return InterviewPlan{}, staffing.Snapshot{}, staffing.HTTPError(err)
	}
	f := facts{roles: roleIDs}
	if f.staffSlot, err = staffSlots(db, cycleID); err != nil {
		return InterviewPlan{}, staffing.Snapshot{}, err
	}
	if f.appSlots, err = applicationSlots(db, ids); err != nil {
		return InterviewPlan{}, staffing.Snapshot{}, err
	}
	if f.names, err = staffNames(db, cycleID); err != nil {
		return InterviewPlan{}, staffing.Snapshot{}, err
	}
	if in.Body.ByPanel {
		if f.panels, err = interviewpanel.ListPanels(db, cycleID); err != nil {
			return InterviewPlan{}, staffing.Snapshot{}, err
		}
	}
	match := false
	if in.Body.MatchSlots != nil {
		match = *in.Body.MatchSlots
	} else if match, err = matchBySlot(db, cycleID); err != nil {
		return InterviewPlan{}, staffing.Snapshot{}, err
	}
	return buildPlan(snap, f, options{byPanel: in.Body.ByPanel, matchSlots: match, withRecording: in.Body.WithRecording}), snap, nil
}

func save(ctx context.Context, tx *gorm.DB, plan InterviewPlan, by string) error {
	store := interviewassignment.NewInterviewAssignmentDB(tx)
	if _, err := store.CreateInterviewers(ctx, pairs(plan.Interviewers), by); err != nil {
		return err
	}
	_, err := store.CreateReviewers(ctx, pairs(plan.RecordingReviewers), by)
	return err
}

func pairs(in []PlannedAssignment) []interviewassignment.AssignmentPair {
	out := make([]interviewassignment.AssignmentPair, len(in))
	for i, p := range in {
		out[i] = interviewassignment.AssignmentPair{ApplicationID: p.ApplicationID, LeadNUID: p.NUID}
	}
	return out
}
