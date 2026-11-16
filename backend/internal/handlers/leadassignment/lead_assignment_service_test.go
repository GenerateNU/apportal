package leadassignment

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type fakeStore struct {
	stage      models.ApplicationStage
	assigned   []string
	conflicted map[string]bool
	deleted    int
	cleared    int
	locked     int
}

func (f *fakeStore) ApplicationOpening(_ context.Context, id string) (opening, error) {
	if id != accesstest.ApplicationID {
		return opening{}, utils.ErrNotFound
	}
	stage := f.stage
	if stage == "" {
		stage = models.StageSubmitted
	}
	return opening{CycleID: accesstest.CycleID, RoleID: accesstest.RoleID, Stage: stage}, nil
}

func (f *fakeStore) AssignmentOpening(_ context.Context, id string) (opening, error) {
	if id != accesstest.AssignmentID {
		return opening{}, utils.ErrNotFound
	}
	return opening{CycleID: accesstest.CycleID, RoleID: accesstest.RoleID}, nil
}

func (f *fakeStore) RoleInCycle(_ context.Context, cycleID, roleID string) (bool, error) {
	return cycleID == accesstest.CycleID && roleID == accesstest.RoleID, nil
}

func (f *fakeStore) Conflicted(_ context.Context, _ string, nuid string) (bool, error) {
	return f.conflicted[nuid], nil
}

func (f *fakeStore) CountAssignments(context.Context, string) (int, error) {
	return len(f.assigned), nil
}

func (f *fakeStore) List(context.Context, string) ([]models.LeadAssignment, error) {
	return []models.LeadAssignment{}, nil
}

func (f *fakeStore) Create(_ context.Context, appID, lead, by string) (models.LeadAssignment, error) {
	for _, a := range f.assigned {
		if a == lead {
			return models.LeadAssignment{}, utils.ErrConflict
		}
	}
	f.assigned = append(f.assigned, lead)
	return models.LeadAssignment{ApplicationID: appID, LeadNUID: lead, AssignedBy: by}, nil
}

func (f *fakeStore) Delete(context.Context, string) error {
	f.deleted++
	return nil
}

func (f *fakeStore) DeleteUnsubmitted(context.Context, string, string) (int, error) {
	f.cleared++
	return 0, nil
}

func (f *fakeStore) Locked(_ context.Context, _ string, fn func(manualStore) error) error {
	f.locked++
	return fn(f)
}

type fakeRules struct {
	released bool
	frozen   bool
	unset    bool
}

func (r fakeRules) PerApplicant(context.Context, string) (int, error) {
	if r.unset {
		return 0, nil
	}
	return 2, nil
}

func (r fakeRules) Frozen(context.Context, string) (map[string]bool, error) {
	return map[string]bool{accesstest.RoleID: r.frozen}, nil
}

func (r fakeRules) Locks(ctx context.Context, cycleID string) (map[string]bool, map[string]bool, error) {
	released, err := r.Released(ctx, cycleID)
	if err != nil {
		return nil, nil, err
	}
	frozen, err := r.Frozen(ctx, cycleID)
	return released, frozen, err
}

func (r fakeRules) Released(context.Context, string) (map[string]bool, error) {
	return map[string]bool{accesstest.RoleID: r.released}, nil
}

func (fakeRules) Eligible(context.Context, string) (map[string][]string, error) {
	return map[string][]string{accesstest.RoleID: {"l1", "l2", "l3", accesstest.ChiefNUID}}, nil
}

func service(store *fakeStore, rules fakeRules) *leadAssignmentService {
	return &leadAssignmentService{access: accesstest.Standard(), store: store, rules: rules}
}

func chief() context.Context {
	return testutil.WithActor(middleware.Actor{NUID: accesstest.ChiefNUID})
}

func statusOf(err error) int {
	if err == nil {
		return http.StatusOK
	}
	var se huma.StatusError
	if errors.As(err, &se) {
		return se.GetStatus()
	}
	return -1
}

func createIn(appID, lead string) *CreateLeadAssignmentInput {
	in := &CreateLeadAssignmentInput{ID: appID}
	in.Body.LeadNUID = lead
	return in
}

func TestLeadAssignmentPermissions(t *testing.T) {
	routes := []struct {
		name string
		call func(*leadAssignmentService, context.Context) error
		want map[string]int
	}{
		{"assign", func(s *leadAssignmentService, ctx context.Context) error {
			_, err := s.create(ctx, createIn(accesstest.ApplicationID, "l1"))
			return err
		}, nil},
		{"unassign", func(s *leadAssignmentService, ctx context.Context) error {
			_, err := s.delete(ctx, &utils.IDInput{ID: accesstest.AssignmentID})
			return err
		}, nil},
		{"unassign all", func(s *leadAssignmentService, ctx context.Context) error {
			_, err := s.deleteAll(ctx, &DeleteAllLeadAssignmentsInput{ID: accesstest.CycleID, RoleID: accesstest.RoleID})
			return err
		}, map[string]int{"applicant": http.StatusNotFound}},
		{"list", func(s *leadAssignmentService, ctx context.Context) error {
			_, err := s.list(ctx, &utils.ApplicationScopedInput{ID: accesstest.ApplicationID})
			return err
		}, map[string]int{"lead on cycle": http.StatusOK}},
	}
	want := map[string]int{
		"admin":           http.StatusOK,
		"chief on cycle":  http.StatusOK,
		"chief elsewhere": http.StatusNotFound,
		"lead on cycle":   http.StatusForbidden,
		"applicant":       http.StatusForbidden,
		"unauthenticated": http.StatusUnauthorized,
	}
	for _, r := range routes {
		for _, p := range accesstest.Personas() {
			t.Run(r.name+"/"+p.Name, func(t *testing.T) {
				w, ok := r.want[p.Name]
				if !ok {
					w = want[p.Name]
				}
				if got := statusOf(r.call(service(&fakeStore{}, fakeRules{}), p.Ctx)); got != w {
					t.Errorf("got %d, want %d", got, w)
				}
			})
		}
	}
}

func TestAssignRules(t *testing.T) {
	cases := []struct {
		name     string
		appID    string
		lead     string
		assigned []string
		want     int
	}{
		{"ok", accesstest.ApplicationID, "l1", nil, http.StatusOK},
		{"a chief can review", accesstest.ApplicationID, accesstest.ChiefNUID, nil, http.StatusOK},
		{"malformed application id", "nope", "l1", nil, http.StatusUnprocessableEntity},
		{"missing lead", accesstest.ApplicationID, "", nil, http.StatusUnprocessableEntity},
		{"not eligible for the opening", accesstest.ApplicationID, "stranger", nil, http.StatusUnprocessableEntity},
		{"already has enough reviewers", accesstest.ApplicationID, "l3", []string{"l1", "l2"}, http.StatusConflict},
		{"already assigned", accesstest.ApplicationID, "l1", []string{"l1"}, http.StatusConflict},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := &fakeStore{assigned: tc.assigned, conflicted: map[string]bool{"l2": true}}
			_, err := service(store, fakeRules{}).create(chief(), createIn(tc.appID, tc.lead))
			if got := statusOf(err); got != tc.want {
				t.Errorf("got %d (%v), want %d", got, err, tc.want)
			}
		})
	}
}

func TestAssignRejectsAConflictedEligibleReviewer(t *testing.T) {
	store := &fakeStore{conflicted: map[string]bool{"l2": true}}
	_, err := service(store, fakeRules{}).create(chief(), createIn(accesstest.ApplicationID, "l2"))
	testutil.WantStatus(t, err, http.StatusConflict)
	if len(store.assigned) != 0 || store.locked != 1 {
		t.Errorf("assigned %v locked %d", store.assigned, store.locked)
	}
}

func TestReleasedReviewsKeepTheirReviewers(t *testing.T) {
	store := &fakeStore{}
	s := service(store, fakeRules{released: true})
	_, err := s.delete(chief(), &utils.IDInput{ID: accesstest.AssignmentID})
	testutil.WantStatus(t, err, http.StatusConflict)
	_, err = s.deleteAll(chief(), &DeleteAllLeadAssignmentsInput{ID: accesstest.CycleID, RoleID: accesstest.RoleID})
	testutil.WantStatus(t, err, http.StatusConflict)
	if store.deleted != 0 || store.cleared != 0 {
		t.Errorf("deleted %d cleared %d", store.deleted, store.cleared)
	}
}

func TestUnassignAllChecksTheOpening(t *testing.T) {
	cases := []struct {
		name, cycleID, roleID string
	}{
		{"malformed role", accesstest.CycleID, "nope"},
		{"malformed cycle", "nope", accesstest.RoleID},
		{"another cycle's opening", accesstest.CycleID, "66666666-6666-4666-8666-666666666666"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := &fakeStore{}
			_, err := service(store, fakeRules{}).deleteAll(chief(), &DeleteAllLeadAssignmentsInput{ID: tc.cycleID, RoleID: tc.roleID})
			testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
			if store.cleared != 0 {
				t.Error("cleared despite a bad opening")
			}
		})
	}
}

func TestUnassignRejectsMalformedID(t *testing.T) {
	_, err := service(&fakeStore{}, fakeRules{}).delete(chief(), &utils.IDInput{ID: "nope"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestAssignOnlyWhileInReview(t *testing.T) {
	for stage, want := range map[models.ApplicationStage]int{
		models.StageSubmitted:   http.StatusOK,
		models.StageLeadReview:  http.StatusOK,
		models.StageChiefReview: http.StatusOK,
		models.StageInterview:   http.StatusConflict,
		models.StageRejected:    http.StatusConflict,
	} {
		t.Run(string(stage), func(t *testing.T) {
			_, err := service(&fakeStore{stage: stage}, fakeRules{}).create(chief(), createIn(accesstest.ApplicationID, "l1"))
			if got := statusOf(err); got != want {
				t.Errorf("got %d (%v), want %d", got, err, want)
			}
		})
	}
}

func TestAssignNeedsReviewersEach(t *testing.T) {
	store := &fakeStore{}
	_, err := service(store, fakeRules{unset: true}).create(chief(), createIn(accesstest.ApplicationID, "l1"))
	testutil.WantStatus(t, err, http.StatusConflict)
	if len(store.assigned) != 0 {
		t.Errorf("assigned %v", store.assigned)
	}
}

func TestFrozenReviewsKeepTheirReviewers(t *testing.T) {
	store := &fakeStore{}
	s := service(store, fakeRules{frozen: true})
	_, err := s.create(chief(), createIn(accesstest.ApplicationID, "l1"))
	testutil.WantStatus(t, err, http.StatusConflict)
	_, err = s.delete(chief(), &utils.IDInput{ID: accesstest.AssignmentID})
	testutil.WantStatus(t, err, http.StatusConflict)
	_, err = s.deleteAll(chief(), &DeleteAllLeadAssignmentsInput{ID: accesstest.CycleID, RoleID: accesstest.RoleID})
	testutil.WantStatus(t, err, http.StatusConflict)
	if len(store.assigned) != 0 || store.deleted != 0 || store.cleared != 0 {
		t.Errorf("assigned %v deleted %d cleared %d", store.assigned, store.deleted, store.cleared)
	}
}
