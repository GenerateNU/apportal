package reviewboard

import (
	"context"
	"slices"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/assign"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
)

type fakeStore struct {
	roles     []string
	staff     []models.CycleStaffMember
	apps      []models.ApplicationSummary
	reviewers []assignedReviewer
	conflicts []staffing.Conflict
	saved     []assign.Pair
	locked    int
}

func (f *fakeStore) RoleIDs(context.Context, string) ([]string, error) { return f.roles, nil }

func (f *fakeStore) Staff(context.Context, string) ([]models.CycleStaffMember, error) {
	return f.staff, nil
}

func (f *fakeStore) Applications(_ context.Context, _ string, stages []models.ApplicationStage) ([]models.ApplicationSummary, error) {
	out := []models.ApplicationSummary{}
	for _, a := range f.apps {
		if slices.Contains(stages, a.Stage) {
			out = append(out, a)
		}
	}
	return out, nil
}

func (f *fakeStore) Reviewers(_ context.Context, _ string, stages []models.ApplicationStage) ([]assignedReviewer, error) {
	out := []assignedReviewer{}
	for _, r := range f.reviewers {
		for _, a := range f.apps {
			if a.ID == r.ApplicationID && slices.Contains(stages, a.Stage) {
				out = append(out, r)
			}
		}
	}
	return out, nil
}

func (f *fakeStore) SaveAssignments(_ context.Context, pairs []assign.Pair, _ string) (int, error) {
	f.saved = append(f.saved, pairs...)
	return len(pairs), nil
}

func (f *fakeStore) Locked(_ context.Context, _ string, fn func(reviewStore) error) error {
	f.locked++
	return fn(f)
}

func (f *fakeStore) Blocked(context.Context, string) (staffing.Blocked, error) {
	out := staffing.Blocked{}
	for _, c := range f.conflicts {
		for _, a := range f.apps {
			if a.UserNUID == c.ApplicantNUID {
				out.Add(a.ID, c.LeadNUID)
			}
		}
	}
	return out, nil
}

type fakeRules struct {
	perApplicant int
	frozen       map[string]bool
	eligible     map[string][]string
}

func (f fakeRules) ForKind(_ context.Context, _ string, _ models.StepKind) (staffing.KindRules, error) {
	p := staffing.KindRules{Limit: f.perApplicant, Eligible: map[string][]string{}, Blocked: map[string]error{}}
	for _, role := range []string{roleA, roleB} {
		p.Eligible[role] = f.eligible[role]
		if f.frozen[role] {
			p.Blocked[role] = huma.Error409Conflict("frozen")
		}
	}
	return p, nil
}

func (f fakeRules) RequireAdd(_ context.Context, _, roleID string, _ models.StepKind) error {
	if f.frozen[roleID] {
		return huma.Error409Conflict("frozen")
	}
	return nil
}

func app(id, nuid, roleID string, stage models.ApplicationStage) models.ApplicationSummary {
	return models.ApplicationSummary{
		Application: models.Application{ID: id, UserNUID: nuid, RoleID: roleID, Stage: stage},
		FullName:    nuid,
	}
}

func staffOf(nuids ...string) []models.CycleStaffMember {
	out := make([]models.CycleStaffMember, len(nuids))
	for i, n := range nuids {
		out[i] = models.CycleStaffMember{UserNUID: n, FullName: "Name " + n, Role: models.CycleStaffLead}
	}
	return out
}

func newReviewService(store *fakeStore, rules fakeRules) *reviewService {
	return &reviewService{gate: accesstest.Standard(), store: store, staff: rules}
}
