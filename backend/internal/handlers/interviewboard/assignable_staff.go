package interviewboard

import (
	"context"
	"errors"
	"sort"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type AssignableReason string

const (
	ReasonAssigned    AssignableReason = "already_assigned"
	ReasonNotOnTeam   AssignableReason = "not_on_team"
	ReasonConflicted  AssignableReason = "conflicted"
	ReasonOtherRole   AssignableReason = "assigned_other_kind"
	ReasonFull        AssignableReason = "full"
	ReasonUnavailable AssignableReason = "unavailable"
)

type AssignableStaff struct {
	NUID      string           `json:"nuid"`
	FullName  string           `json:"full_name"`
	Available bool             `json:"available"`
	Reason    AssignableReason `json:"reason,omitempty" enum:"already_assigned,not_on_team,conflicted,assigned_other_kind,full,unavailable" doc:"Why they can't be added; assigned_other_kind means they interview this applicant and so can't review the recording, or the reverse"`
}

type AssignableApplication struct {
	ApplicationID string            `json:"application_id"`
	RoleID        string            `json:"role_id"`
	Locked        string            `json:"locked,omitempty" doc:"Why nobody can be added to this applicant right now"`
	Staff         []AssignableStaff `json:"staff"`
}

type AssignableInput struct {
	ID             string          `path:"id" doc:"Cycle ID"`
	Kind           models.StepKind `query:"kind" required:"true" enum:"reviewer,interviewer,recording_reviewer"`
	ApplicationIDs string          `query:"application_ids" required:"true" doc:"Comma-separated application ids, at most 200"`
}

type AssignableOutput struct {
	Body []AssignableApplication
}

func (s *interviewBoardService) assignable(ctx context.Context, in *AssignableInput) (*AssignableOutput, error) {
	ids := utils.SplitIDs(in.ApplicationIDs)
	switch {
	case !in.Kind.Staff():
		return nil, huma.Error422UnprocessableEntity(staffing.ErrNotStaffKind.Error())
	case len(ids) == 0:
		return nil, huma.Error422UnprocessableEntity("application_ids is required")
	case len(ids) > utils.MaxBulkApplications:
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	if err := utils.RequireUUIDs("cycle id", in.ID); err != nil {
		return nil, err
	}
	for _, id := range ids {
		if err := utils.RequireUUIDs("application id", id); err != nil {
			return nil, err
		}
	}
	if err := s.gate.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	db := s.db.WithContext(ctx)
	snap, err := s.guard.Load(ctx, db, in.ID, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	facts, err := pipeline.Load(db, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	names, err := staffNames(db, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	actor, _ := middleware.ActorFrom(ctx)
	admin := actor.HasRole(models.UserRoleAdmin)
	limit := snap.Limits[in.Kind]

	out := make([]AssignableApplication, 0, len(ids))
	for _, id := range ids {
		a := snap.Applicants[id]
		if a == nil {
			return nil, huma.Error404NotFound("application " + id + " isn't in this cycle")
		}
		row := AssignableApplication{ApplicationID: id, RoleID: a.RoleID, Locked: lockedReason(facts, *a, in.Kind, limit, admin)}
		rules := staffing.Rules{Limit: limit, Eligible: snap.Openings.Eligible(a.RoleID, in.Kind)}
		if limit <= 0 {
			rules.Limit = len(snap.Openings.Staff) + 1
		}
		for _, nuid := range snap.Openings.Staff {
			p := AssignableStaff{NUID: nuid, FullName: names[nuid]}
			if p.FullName == "" {
				p.FullName = nuid
			}
			p.Reason = reasonFor(staffing.Check(*a, rules, nuid, in.Kind))
			p.Available = p.Reason == "" && row.Locked == ""
			row.Staff = append(row.Staff, p)
		}
		sort.SliceStable(row.Staff, func(i, j int) bool { return row.Staff[i].FullName < row.Staff[j].FullName })
		out = append(out, row)
	}
	return &AssignableOutput{Body: out}, nil
}

func lockedReason(f *pipeline.Facts, a staffing.Applicant, kind models.StepKind, limit int, admin bool) string {
	roleID := a.RoleID
	step := models.StepInterviews
	if kind == models.KindReviewer {
		step = models.StepReviews
		if s, _ := pipeline.StepOfStage(a.Stage); s != models.StepApplications && s != models.StepReviews {
			return "reviewers can only be assigned while an application is submitted or in review"
		}
	}
	if err := f.Lock(pipeline.Action{Op: pipeline.OpAssign, Step: step, RoleID: roleID, Admin: admin}); err != nil {
		return errMessage(err)
	}
	if step == models.StepInterviews && f.Released(roleID, step) {
		return staffing.ErrLocked.Error()
	}
	if limit <= 0 {
		if err := (staffing.Rules{}).RequireLimit(kind); err != nil {
			return err.Error()
		}
		return staffing.ErrOff.Error()
	}
	return ""
}

func errMessage(err error) string {
	var m *huma.ErrorModel
	if errors.As(err, &m) {
		return m.Detail
	}
	return err.Error()
}

func reasonFor(err error) AssignableReason {
	switch {
	case err == nil:
		return ""
	case errors.Is(err, staffing.ErrAlready):
		return ReasonAssigned
	case errors.Is(err, staffing.ErrNotEligible):
		return ReasonNotOnTeam
	case errors.Is(err, staffing.ErrConflicted):
		return ReasonConflicted
	case errors.Is(err, staffing.ErrSamePerson):
		return ReasonOtherRole
	case errors.Is(err, staffing.ErrFull):
		return ReasonFull
	}
	return ReasonUnavailable
}
