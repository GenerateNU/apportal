package conflict

import (
	"context"
	"net/http"
	"slices"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type fakeStore struct {
	staff      []string
	applicants []string
	conflicts  []staffing.Conflict
}

func (f *fakeStore) List(context.Context, string) ([]staffing.Conflict, error) {
	return append([]staffing.Conflict{}, f.conflicts...), nil
}

func (f *fakeStore) Put(_ context.Context, _ string, lead, applicant string) error {
	if !slices.ContainsFunc(f.conflicts, func(c staffing.Conflict) bool { return c.LeadNUID == lead && c.ApplicantNUID == applicant }) {
		f.conflicts = append(f.conflicts, staffing.Conflict{LeadNUID: lead, ApplicantNUID: applicant})
	}
	return nil
}

func (f *fakeStore) Delete(_ context.Context, _ string, lead, applicant string) error {
	f.conflicts = slices.DeleteFunc(f.conflicts, func(c staffing.Conflict) bool { return c.LeadNUID == lead && c.ApplicantNUID == applicant })
	return nil
}

func (f *fakeStore) IsStaff(_ context.Context, _ string, nuid string) (bool, error) {
	return slices.Contains(f.staff, nuid), nil
}

func (f *fakeStore) HasApplicant(_ context.Context, _ string, nuid string) (bool, error) {
	return slices.Contains(f.applicants, nuid), nil
}

func newTestService() *service {
	return &service{gate: accesstest.Standard(), store: &fakeStore{staff: []string{"l1"}, applicants: []string{"u1"}}}
}

func chief() context.Context { return testutil.WithActor(middleware.Actor{NUID: accesstest.ChiefNUID}) }

func TestPermissions(t *testing.T) {
	in := func(id string) *ConflictInput { return &ConflictInput{ID: id, LeadNUID: "l1", ApplicantNUID: "u1"} }
	routes := map[string]func(*service, context.Context, string) error{
		"list": func(s *service, ctx context.Context, id string) error {
			_, err := s.list(ctx, &utils.CycleScopedInput{ID: id})
			return err
		},
		"add":    func(s *service, ctx context.Context, id string) error { _, err := s.add(ctx, in(id)); return err },
		"remove": func(s *service, ctx context.Context, id string) error { _, err := s.remove(ctx, in(id)); return err },
	}
	want := map[string]int{"admin": 0, "chief on cycle": 0, "chief elsewhere": http.StatusNotFound, "lead on cycle": http.StatusForbidden, "applicant": http.StatusNotFound, "unauthenticated": http.StatusUnauthorized}
	for name, call := range routes {
		for _, p := range accesstest.Personas() {
			t.Run(name+"/"+p.Name, func(t *testing.T) {
				err := call(newTestService(), p.Ctx, accesstest.CycleID)
				if want[p.Name] == 0 {
					if err != nil {
						t.Fatal(err)
					}
					return
				}
				testutil.WantStatus(t, err, want[p.Name])
			})
		}
		testutil.WantStatus(t, call(newTestService(), chief(), "not-a-uuid"), http.StatusUnprocessableEntity)
	}
}

func TestAddValidatesBothPeople(t *testing.T) {
	_, err := newTestService().add(chief(), &ConflictInput{ID: accesstest.CycleID, LeadNUID: "stranger", ApplicantNUID: "u1"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	_, err = newTestService().add(chief(), &ConflictInput{ID: accesstest.CycleID, LeadNUID: "l1", ApplicantNUID: "nobody"})
	testutil.WantStatus(t, err, http.StatusNotFound)
}

func TestWritesAreIdempotent(t *testing.T) {
	s := newTestService()
	in := &ConflictInput{ID: accesstest.CycleID, LeadNUID: "l1", ApplicantNUID: "u1"}
	for range 2 {
		if out, err := s.add(chief(), in); err != nil || len(out.Body) != 1 {
			t.Fatalf("put: %v %+v", err, out)
		}
	}
	for range 2 {
		if out, err := s.remove(chief(), in); err != nil || len(out.Body) != 0 {
			t.Fatalf("delete: %v %+v", err, out)
		}
	}
}
