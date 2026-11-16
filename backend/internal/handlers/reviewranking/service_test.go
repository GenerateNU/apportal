package reviewranking

import (
	"context"
	"math"
	"net/http"
	"slices"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

const (
	cycleID    = "6f1c2a52-6d2c-4a8e-9a57-2b8f3b1c9d10"
	otherCycle = "0b7e4d1a-3c2f-4e8a-9d6b-5a4c3b2a1f00"
	roleID     = "2d3c4b5a-6978-4a1b-8c2d-3e4f5a6b7c8d"
	appTop     = "a0000000-0000-4000-8000-000000000001"
	appMid     = "a0000000-0000-4000-8000-000000000002"
	appLow     = "a0000000-0000-4000-8000-000000000003"
)

var (
	adminActor     = middleware.Actor{NUID: "admin", Roles: []models.UserRole{models.UserRoleAdmin}}
	chiefActor     = middleware.Actor{NUID: "chief", Roles: []models.UserRole{models.UserRoleApplicant}}
	chiefElsewhere = middleware.Actor{NUID: "other-chief", Roles: []models.UserRole{models.UserRoleApplicant}}
	leadActor      = middleware.Actor{NUID: "lead", Roles: []models.UserRole{models.UserRoleApplicant}}
	applicantActor = middleware.Actor{NUID: "applicant", Roles: []models.UserRole{models.UserRoleApplicant}}
)

type fakeAuth struct {
	staff  map[string]map[string]models.CycleStaffRole
	owners map[string]string
}

func newFakeAuth() *fakeAuth {
	return &fakeAuth{
		staff: map[string]map[string]models.CycleStaffRole{
			"chief":       {cycleID: models.CycleStaffChief},
			"other-chief": {otherCycle: models.CycleStaffChief},
			"lead":        {cycleID: models.CycleStaffLead},
		},
		owners: map[string]string{appTop: "applicant", appMid: "someone", appLow: "someone"},
	}
}

func (f *fakeAuth) level(ctx context.Context, cycle string) (middleware.Actor, access.Level, error) {
	if err := access.RequireActor(ctx); err != nil {
		return middleware.Actor{}, access.None, err
	}
	actor, _ := middleware.ActorFrom(ctx)
	return actor, access.LevelFor(access.IsAdmin(actor), f.staff[actor.NUID][cycle], models.CycleOpen, models.ApplicationTypeMember), nil
}

func (f *fakeAuth) Cycle(ctx context.Context, cycle string) (access.CycleAccess, error) {
	actor, l, err := f.level(ctx, cycle)
	return access.CycleAccessAt(l, access.IsAdmin(actor)), err
}

func (f *fakeAuth) Application(ctx context.Context, id string) (access.ApplicationAccess, error) {
	actor, l, err := f.level(ctx, cycleID)
	return access.ApplicationAccessAt(l, f.owners[id] == actor.NUID), err
}

type fakeStore struct {
	apps      []AppRow
	scores    []ScoreRow
	overrides map[string]bool
	cutoff    *models.ReviewCutoff
	writes    []string
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		apps: []AppRow{{appTop, models.StageLeadReview}, {appMid, models.StageChiefReview}, {appLow, models.StageLeadReview}},
		scores: []ScoreRow{
			sc(appTop, "r1", "q", 9, 1, 10), sc(appMid, "r1", "q", 6, 1, 10), sc(appLow, "r1", "q", 2, 1, 10),
		},
		overrides: map[string]bool{},
		cutoff:    &models.ReviewCutoff{CycleID: cycleID, RoleID: roleID, Mode: models.CutoffTopN, Value: 2},
	}
}

func (f *fakeStore) ListApplications(context.Context, string, string) ([]AppRow, error) {
	return f.apps, nil
}
func (f *fakeStore) ListScores(context.Context, string, string) ([]ScoreRow, error) {
	return f.scores, nil
}
func (f *fakeStore) ListOverrides(context.Context, string, string) (map[string]bool, error) {
	return f.overrides, nil
}
func (f *fakeStore) GetCutoff(context.Context, string, string) (*models.ReviewCutoff, error) {
	return f.cutoff, nil
}
func (f *fakeStore) UpsertCutoff(_ context.Context, c models.ReviewCutoff) (models.ReviewCutoff, error) {
	f.writes = append(f.writes, "upsert-cutoff")
	return c, nil
}
func (f *fakeStore) DeleteCutoff(context.Context, string, string) error {
	f.writes = append(f.writes, "delete-cutoff")
	return nil
}
func (f *fakeStore) ApplicationOpening(_ context.Context, id string) (string, string, error) {
	if _, ok := newFakeAuth().owners[id]; !ok {
		return "", "", utils.ErrNotFound
	}
	return cycleID, roleID, nil
}
func (f *fakeStore) UpsertOverride(_ context.Context, o models.ReviewCutoffOverride) (models.ReviewCutoffOverride, error) {
	f.writes = append(f.writes, "upsert-override")
	return o, nil
}
func (f *fakeStore) DeleteOverride(context.Context, string) error {
	f.writes = append(f.writes, "delete-override")
	return nil
}
func (f *fakeStore) DeleteOverrides(context.Context, string, string) error {
	f.writes = append(f.writes, "delete-overrides")
	return nil
}

type fakeRoles struct{}

func (fakeRoles) CycleHasRole(_ context.Context, cycle, role string) (bool, error) {
	return cycle == cycleID && role == roleID, nil
}

type fakeRules struct {
	reviewsIn bool
	advanced  []string
	actor     pipeline.Actor
	err       error
}

func (f *fakeRules) ReviewsIn(context.Context, string, string) (bool, error) {
	return f.reviewsIn, nil
}

func (f *fakeRules) Advance(_ context.Context, _, _ string, ids []string, actor pipeline.Actor) ([]string, error) {
	f.advanced, f.actor = ids, actor
	return ids, f.err
}

type fixture struct {
	svc   *rankingService
	store *fakeStore
	rules *fakeRules
}

func newFixture() fixture {
	store, rules := newFakeStore(), &fakeRules{reviewsIn: true}
	return fixture{
		svc:   &rankingService{access: newFakeAuth(), store: store, roles: fakeRoles{}, rules: rules},
		store: store,
		rules: rules,
	}
}

type call func(context.Context, *rankingService) error

var routes = map[string]call{
	"get ranking": func(ctx context.Context, s *rankingService) error {
		_, err := s.get(ctx, &OpeningInput{ID: cycleID, RoleID: roleID})
		return err
	},
	"put cutoff": func(ctx context.Context, s *rankingService) error {
		in := &PutCutoffInput{ID: cycleID, RoleID: roleID}
		in.Body.Mode, in.Body.Value = models.CutoffMinScore, 0
		_, err := s.putCutoff(ctx, in)
		return err
	},
	"delete cutoff": func(ctx context.Context, s *rankingService) error {
		_, err := s.deleteCutoff(ctx, &OpeningInput{ID: cycleID, RoleID: roleID})
		return err
	},
	"put override": func(ctx context.Context, s *rankingService) error {
		in := &PutOverrideInput{ID: appTop}
		in.Body.Included = true
		_, err := s.putOverride(ctx, in)
		return err
	},
	"delete override": func(ctx context.Context, s *rankingService) error {
		_, err := s.deleteOverride(ctx, &utils.ApplicationScopedInput{ID: appTop})
		return err
	},
	"delete overrides": func(ctx context.Context, s *rankingService) error {
		_, err := s.deleteOverrides(ctx, &OpeningInput{ID: cycleID, RoleID: roleID})
		return err
	},
	"advance shortlist": func(ctx context.Context, s *rankingService) error {
		_, err := s.advance(ctx, &AdvanceInput{ID: cycleID, RoleID: roleID})
		return err
	},
}

var applicationRoutes = map[string]bool{"put override": true, "delete override": true}

func TestPermissions(t *testing.T) {
	personas := []struct {
		name          string
		ctx           context.Context
		want, wantApp int
	}{
		{"admin", testutil.WithActor(adminActor), http.StatusOK, http.StatusOK},
		{"chief on the cycle", testutil.WithActor(chiefActor), http.StatusOK, http.StatusOK},
		{"chief on another cycle", testutil.WithActor(chiefElsewhere), http.StatusNotFound, http.StatusNotFound},
		{"lead on the cycle", testutil.WithActor(leadActor), http.StatusForbidden, http.StatusForbidden},
		{"applicant who owns the application", testutil.WithActor(applicantActor), http.StatusNotFound, http.StatusForbidden},
		{"unauthenticated", context.Background(), http.StatusUnauthorized, http.StatusUnauthorized},
	}
	for route, run := range routes {
		for _, p := range personas {
			t.Run(route+"/"+p.name, func(t *testing.T) {
				f := newFixture()
				want := p.want
				if applicationRoutes[route] {
					want = p.wantApp
				}
				err := run(p.ctx, f.svc)
				if want == http.StatusOK {
					if err != nil {
						t.Fatalf("want success, got %v", err)
					}
					return
				}
				testutil.WantStatus(t, err, want)
				if len(f.store.writes) > 0 || f.rules.advanced != nil {
					t.Fatalf("a refused call still wrote: %v %v", f.store.writes, f.rules.advanced)
				}
			})
		}
	}
}

func TestWritesWaitForReviews(t *testing.T) {
	for route, run := range routes {
		t.Run(route, func(t *testing.T) {
			f := newFixture()
			f.rules.reviewsIn = false
			err := run(testutil.WithActor(chiefActor), f.svc)
			if route == "get ranking" {
				if err != nil {
					t.Fatalf("reading the ranking isn't gated: %v", err)
				}
				return
			}
			testutil.WantStatus(t, err, http.StatusConflict)
			if len(f.store.writes) > 0 || f.rules.advanced != nil {
				t.Fatalf("a gated call still wrote: %v %v", f.store.writes, f.rules.advanced)
			}
		})
	}
}

func TestGetReportsGate(t *testing.T) {
	f := newFixture()
	f.rules.reviewsIn = false
	out, err := f.svc.get(testutil.WithActor(chiefActor), &OpeningInput{ID: cycleID, RoleID: roleID})
	if err != nil {
		t.Fatal(err)
	}
	if out.Body.ReviewsIn || len(out.Body.Entries) != 3 || out.Body.Cutoff == nil {
		t.Fatalf("unexpected ranking: %+v", out.Body)
	}
}

func TestOpeningValidation(t *testing.T) {
	ctx := testutil.WithActor(chiefActor)
	cases := []struct {
		name         string
		cycle, role  string
		wantStatus   int
		applyToWrite bool
	}{
		{"malformed cycle id", "not-a-uuid", roleID, http.StatusUnprocessableEntity, true},
		{"missing role", cycleID, "", http.StatusUnprocessableEntity, true},
		{"malformed role", cycleID, "swe", http.StatusUnprocessableEntity, true},
		{"role from another cycle", cycleID, "9d3c4b5a-6978-4a1b-8c2d-3e4f5a6b7c8d", http.StatusUnprocessableEntity, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := newFixture().svc
			_, err := s.get(ctx, &OpeningInput{ID: tc.cycle, RoleID: tc.role})
			testutil.WantStatus(t, err, tc.wantStatus)
			_, err = s.deleteOverrides(ctx, &OpeningInput{ID: tc.cycle, RoleID: tc.role})
			testutil.WantStatus(t, err, tc.wantStatus)
			_, err = s.advance(ctx, &AdvanceInput{ID: tc.cycle, RoleID: tc.role})
			testutil.WantStatus(t, err, tc.wantStatus)
		})
	}
}

func TestOverrideValidation(t *testing.T) {
	ctx := testutil.WithActor(chiefActor)
	_, err := newFixture().svc.putOverride(ctx, &PutOverrideInput{ID: "a1"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	_, err = newFixture().svc.deleteOverride(ctx, &utils.ApplicationScopedInput{ID: ""})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	_, err = newFixture().svc.putOverride(ctx, &PutOverrideInput{ID: "f0000000-0000-4000-8000-00000000000f"})
	testutil.WantStatus(t, err, http.StatusNotFound)
}

func TestValidateCutoff(t *testing.T) {
	ok := []struct {
		mode  models.CutoffMode
		value float64
	}{
		{models.CutoffMinScore, -0.5},
		{models.CutoffMinScore, 1.25},
		{models.CutoffMinScore, 0},
		{models.CutoffTopN, 0},
		{models.CutoffTopN, 40},
	}
	for _, c := range ok {
		if err := validateCutoff(c.mode, c.value); err != nil {
			t.Errorf("%s %v: %v", c.mode, c.value, err)
		}
	}
	bad := []struct {
		mode  models.CutoffMode
		value float64
	}{
		{"", 1},
		{"top_percent", 10},
		{models.CutoffTopN, -1},
		{models.CutoffTopN, 2.5},
		{models.CutoffTopN, 1e12},
		{models.CutoffTopN, math.NaN()},
		{models.CutoffMinScore, math.NaN()},
		{models.CutoffMinScore, math.Inf(1)},
		{models.CutoffMinScore, math.Inf(-1)},
	}
	for _, c := range bad {
		testutil.WantStatus(t, validateCutoff(c.mode, c.value), http.StatusUnprocessableEntity)
	}
}

func TestPutCutoffRejectsBadValueBeforeWriting(t *testing.T) {
	f := newFixture()
	in := &PutCutoffInput{ID: cycleID, RoleID: roleID}
	in.Body.Mode, in.Body.Value = models.CutoffTopN, -3
	_, err := f.svc.putCutoff(testutil.WithActor(chiefActor), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	if len(f.store.writes) > 0 {
		t.Fatalf("wrote %v", f.store.writes)
	}
}

func TestAdvance(t *testing.T) {
	ctx := testutil.WithActor(chiefActor)
	t.Run("defaults to everyone included", func(t *testing.T) {
		f := newFixture()
		f.store.overrides = map[string]bool{appMid: false, appLow: true}
		out, err := f.svc.advance(ctx, &AdvanceInput{ID: cycleID, RoleID: roleID})
		if err != nil {
			t.Fatal(err)
		}
		if want := []string{appTop, appLow}; !slices.Equal(f.rules.advanced, want) || !slices.Equal(out.Body.Moved, want) {
			t.Fatalf("advanced %v, moved %v, want %v", f.rules.advanced, out.Body.Moved, want)
		}
	})
	t.Run("a chosen subset of the shortlist", func(t *testing.T) {
		f := newFixture()
		in := &AdvanceInput{ID: cycleID, RoleID: roleID}
		in.Body = &AdvanceBody{ApplicationIDs: []string{appMid, appMid}}
		if _, err := f.svc.advance(ctx, in); err != nil {
			t.Fatal(err)
		}
		if !slices.Equal(f.rules.advanced, []string{appMid}) {
			t.Fatalf("advanced %v", f.rules.advanced)
		}
	})
	t.Run("someone off the shortlist", func(t *testing.T) {
		f := newFixture()
		in := &AdvanceInput{ID: cycleID, RoleID: roleID}
		in.Body = &AdvanceBody{ApplicationIDs: []string{appTop, appLow}}
		_, err := f.svc.advance(ctx, in)
		testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
		if f.rules.advanced != nil {
			t.Fatalf("advanced %v", f.rules.advanced)
		}
	})
	t.Run("malformed id", func(t *testing.T) {
		in := &AdvanceInput{ID: cycleID, RoleID: roleID}
		in.Body = &AdvanceBody{ApplicationIDs: []string{"nope"}}
		_, err := newFixture().svc.advance(ctx, in)
		testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	})
	t.Run("too many ids", func(t *testing.T) {
		in := &AdvanceInput{ID: cycleID, RoleID: roleID}
		in.Body = &AdvanceBody{ApplicationIDs: make([]string, utils.MaxBulkApplications+1)}
		for i := range in.Body.ApplicationIDs {
			in.Body.ApplicationIDs[i] = appTop
		}
		_, err := newFixture().svc.advance(ctx, in)
		testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	})
	t.Run("passes who is advancing", func(t *testing.T) {
		for _, tc := range []struct {
			actor middleware.Actor
			admin bool
		}{{chiefActor, false}, {adminActor, true}} {
			f := newFixture()
			if _, err := f.svc.advance(testutil.WithActor(tc.actor), &AdvanceInput{ID: cycleID, RoleID: roleID}); err != nil {
				t.Fatal(err)
			}
			if want := (pipeline.Actor{NUID: tc.actor.NUID, Admin: tc.admin}); f.rules.actor != want {
				t.Fatalf("actor %+v, want %+v", f.rules.actor, want)
			}
		}
	})
	t.Run("no stage to move into", func(t *testing.T) {
		f := newFixture()
		f.rules.err = ErrNoNextStage
		_, err := f.svc.advance(ctx, &AdvanceInput{ID: cycleID, RoleID: roleID})
		testutil.WantStatus(t, err, http.StatusConflict)
	})
}

func TestShortlisted(t *testing.T) {
	entries := []models.ReviewRankingEntry{{ApplicationID: "a", Included: true}, {ApplicationID: "b"}, {ApplicationID: "c", Included: true}}
	got, err := shortlisted(entries, nil)
	if err != nil || !slices.Equal(got, []string{"a", "c"}) {
		t.Fatalf("got %v %v", got, err)
	}
	got, err = shortlisted(nil, nil)
	if err != nil || got == nil || len(got) != 0 {
		t.Fatalf("an empty shortlist is an empty list: %v %v", got, err)
	}
	_, err = shortlisted(entries, []string{"a", "b"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}
