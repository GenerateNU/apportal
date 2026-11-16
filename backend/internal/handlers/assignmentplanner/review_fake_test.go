package assignmentplanner

import (
	"context"
	"slices"

	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/assign"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/reviewrules"
)

type fakeStore struct {
	roles     []string
	staff     []models.CycleStaffMember
	apps      []models.ApplicationSummary
	reviewers []assignedReviewer
	conflicts []reviewrules.Conflict
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

func (f *fakeStore) ListConflicts(context.Context, string) ([]reviewrules.Conflict, error) {
	return append([]reviewrules.Conflict{}, f.conflicts...), nil
}

func (f *fakeStore) PutConflict(_ context.Context, _ string, lead, applicant string) error {
	for _, c := range f.conflicts {
		if c.LeadNUID == lead && c.ApplicantNUID == applicant {
			return nil
		}
	}
	f.conflicts = append(f.conflicts, reviewrules.Conflict{LeadNUID: lead, ApplicantNUID: applicant})
	return nil
}

func (f *fakeStore) DeleteConflict(_ context.Context, _ string, lead, applicant string) error {
	f.conflicts = slices.DeleteFunc(f.conflicts, func(c reviewrules.Conflict) bool {
		return c.LeadNUID == lead && c.ApplicantNUID == applicant
	})
	return nil
}

func (f *fakeStore) IsStaff(_ context.Context, _ string, nuid string) (bool, error) {
	return slices.ContainsFunc(f.staff, func(m models.CycleStaffMember) bool { return m.UserNUID == nuid }), nil
}

func (f *fakeStore) HasApplicant(_ context.Context, _ string, nuid string) (bool, error) {
	return slices.ContainsFunc(f.apps, func(a models.ApplicationSummary) bool {
		return a.UserNUID == nuid && a.Stage != models.StageDraft
	}), nil
}

func (f *fakeStore) Blocked(context.Context, string) (reviewrules.Blocked, error) {
	out := reviewrules.Blocked{}
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
	released     map[string]bool
	frozen       map[string]bool
	eligible     map[string][]string
}

func (f fakeRules) PerApplicant(context.Context, string) (int, error) { return f.perApplicant, nil }

func (f fakeRules) Released(context.Context, string) (map[string]bool, error) {
	return f.released, nil
}

func (f fakeRules) Frozen(context.Context, string) (map[string]bool, error) {
	return f.frozen, nil
}

func (f fakeRules) Eligible(context.Context, string) (map[string][]string, error) {
	return f.eligible, nil
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
	return &reviewService{gate: accesstest.Standard(), store: store, rules: rules}
}
