// Package accesstest runs a handler against each kind of caller and checks
// whether it got past the access gate, with no database behind it.
package accesstest

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

const (
	CycleID       = "11111111-1111-1111-1111-111111111111"
	OtherCycleID  = "22222222-2222-2222-2222-222222222222"
	ApplicationID = "33333333-3333-3333-3333-333333333333"
	RoleID        = "44444444-4444-4444-4444-444444444444"
	ItemID        = "55555555-5555-5555-5555-555555555555"
	ApplicantNUID = "applicant"
)

type Caller struct {
	Name  string
	Actor *middleware.Actor
}

var (
	Admin          = Caller{"admin", &middleware.Actor{NUID: "admin", Roles: []models.UserRole{models.UserRoleAdmin}}}
	ChiefOnCycle   = Caller{"chief on cycle", &middleware.Actor{NUID: "chief", Roles: []models.UserRole{models.UserRoleApplicant}}}
	ChiefElsewhere = Caller{"chief elsewhere", &middleware.Actor{NUID: "other-chief", Roles: []models.UserRole{models.UserRoleApplicant}}}
	LeadOnCycle    = Caller{"lead on cycle", &middleware.Actor{NUID: "lead", Roles: []models.UserRole{models.UserRoleApplicant}}}
	Applicant      = Caller{"applicant", &middleware.Actor{NUID: ApplicantNUID, Roles: []models.UserRole{models.UserRoleApplicant}}}
	Anonymous      = Caller{"unauthenticated", nil}
	Callers        = []Caller{Admin, ChiefOnCycle, ChiefElsewhere, LeadOnCycle, Applicant, Anonymous}
)

func Fixture() access.Static {
	open := func(staff map[string]models.CycleStaffRole) access.StaticCycle {
		return access.StaticCycle{Status: models.CycleOpen, Type: models.ApplicationTypeMember, Staff: staff}
	}
	return access.Static{
		Cycles: map[string]access.StaticCycle{
			CycleID:      open(map[string]models.CycleStaffRole{"chief": models.CycleStaffChief, "lead": models.CycleStaffLead}),
			OtherCycleID: open(map[string]models.CycleStaffRole{"other-chief": models.CycleStaffChief}),
		},
		Applications: map[string]access.StaticApplication{
			ApplicationID: {CycleID: CycleID, Owner: ApplicantNUID, Stage: models.StageInterview},
		},
	}
}

// Recorder passes a call only if every check it made allowed it.
type Recorder struct {
	access.Static
	allowed, denied int
}

func (r *Recorder) record(err error) error {
	if err == nil {
		r.allowed++
	} else {
		r.denied++
	}
	return err
}

func (r *Recorder) CanCycle(ctx context.Context, action access.CycleAction, cycleID string) error {
	return r.record(r.Static.CanCycle(ctx, action, cycleID))
}

func (r *Recorder) CanApplication(ctx context.Context, action access.ApplicationAction, applicationID string) error {
	return r.record(r.Static.CanApplication(ctx, action, applicationID))
}

func (r *Recorder) Passed() bool {
	return r.allowed > 0 && r.denied == 0
}

// Allow marks a caller who gets past the gate; any other value is the status
// the call must fail with.
const Allow = 0

type Want map[string]int

var (
	Managers = Want{Admin.Name: Allow, ChiefOnCycle.Name: Allow, ChiefElsewhere.Name: http.StatusNotFound,
		LeadOnCycle.Name: http.StatusForbidden, Applicant.Name: http.StatusNotFound, Anonymous.Name: http.StatusUnauthorized}
	OwnerOnly = Want{Admin.Name: http.StatusForbidden, ChiefOnCycle.Name: http.StatusForbidden, ChiefElsewhere.Name: http.StatusNotFound,
		LeadOnCycle.Name: http.StatusForbidden, Applicant.Name: Allow, Anonymous.Name: http.StatusUnauthorized}
	OwnerOrStaff = Want{Admin.Name: Allow, ChiefOnCycle.Name: Allow, ChiefElsewhere.Name: http.StatusNotFound,
		LeadOnCycle.Name: Allow, Applicant.Name: Allow, Anonymous.Name: http.StatusUnauthorized}
)

// Run calls the handler once per caller with a fresh Recorder wired in by
// setup, and checks the outcome against want.
func Run(t *testing.T, want Want, call func(ctx context.Context, gate access.Gate) error) {
	t.Helper()
	for _, c := range Callers {
		t.Run(c.Name, func(t *testing.T) {
			ctx := context.Background()
			if c.Actor != nil {
				ctx = testutil.WithActor(*c.Actor)
			}
			gate := &Recorder{Static: Fixture()}
			err := safely(func() error { return call(ctx, gate) })
			status, ok := want[c.Name]
			if !ok {
				t.Fatalf("no expectation for %s", c.Name)
			}
			if status == Allow {
				if !gate.Passed() {
					t.Fatalf("want past the gate, got %v", err)
				}
				return
			}
			if gate.Passed() {
				t.Fatalf("want %d, got past the gate", status)
			}
			testutil.WantStatus(t, err, status)
		})
	}
}

func safely(f func() error) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = huma.Error500InternalServerError(fmt.Sprint(r))
		}
	}()
	return f()
}

// DB builds SQL without ever opening a connection; queries return nothing and
// transactions fail.
func DB(t *testing.T) *gorm.DB {
	t.Helper()
	g, err := gorm.Open(postgres.New(postgres.Config{Conn: noConn{}}), &gorm.Config{
		NamingStrategy: db.NamingStrategy, DryRun: true, DisableAutomaticPing: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	return g
}

var errNoConn = errors.New("no database in this test")

type noConn struct{}

func (noConn) PrepareContext(context.Context, string) (*sql.Stmt, error) { return nil, errNoConn }
func (noConn) ExecContext(context.Context, string, ...any) (sql.Result, error) {
	return nil, errNoConn
}
func (noConn) QueryContext(context.Context, string, ...any) (*sql.Rows, error) {
	return nil, errNoConn
}
func (noConn) QueryRowContext(context.Context, string, ...any) *sql.Row { return nil }
