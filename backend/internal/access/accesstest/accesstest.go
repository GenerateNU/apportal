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
	CycleID       = "11111111-1111-4111-8111-111111111111"
	OtherCycleID  = "22222222-2222-4222-8222-222222222222"
	ApplicationID = "33333333-3333-4333-8333-333333333333"
	AssignmentID  = "44444444-4444-4444-8444-444444444444"
	RoleID        = "55555555-5555-4555-8555-555555555555"
	ItemID        = "66666666-6666-4666-8666-666666666666"

	AdminNUID     = "admin"
	ChiefNUID     = "chief"
	OtherChief    = "chief-elsewhere"
	LeadNUID      = "lead"
	ApplicantNUID = "applicant"
)

// Gate treats every cycle as an open member cycle.
type Gate struct {
	Staff  map[string]map[string]models.CycleStaffRole
	Rows   map[string]string
	Owners map[string]string
}

func Standard() Gate {
	return Gate{
		Staff: map[string]map[string]models.CycleStaffRole{
			CycleID:      {ChiefNUID: models.CycleStaffChief, LeadNUID: models.CycleStaffLead},
			OtherCycleID: {OtherChief: models.CycleStaffChief},
		},
		Rows:   map[string]string{ApplicationID: CycleID, AssignmentID: CycleID},
		Owners: map[string]string{ApplicationID: ApplicantNUID, AssignmentID: ApplicantNUID},
	}
}

func (g Gate) level(ctx context.Context, cycleID string) (access.Level, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return access.None, access.RequireActor(ctx)
	}
	return access.LevelFor(access.IsAdmin(actor), g.Staff[cycleID][actor.NUID], models.CycleOpen, models.ApplicationTypeMember), nil
}

func (g Gate) CanCycle(ctx context.Context, action access.CycleAction, cycleID string) error {
	l, err := g.level(ctx, cycleID)
	if err != nil {
		return err
	}
	actor, _ := middleware.ActorFrom(ctx)
	return access.CycleAccessAt(l, access.IsAdmin(actor)).Can(action)
}

func (g Gate) CanApplication(ctx context.Context, action access.ApplicationAction, id string) error {
	l, err := g.level(ctx, g.Rows[id])
	if err != nil {
		return err
	}
	actor, _ := middleware.ActorFrom(ctx)
	return access.ApplicationAccessAt(l, g.Owners[id] != "" && g.Owners[id] == actor.NUID).Can(action)
}

func (g Gate) CanApplicationOf(ctx context.Context, action access.ApplicationAction, _ string, id string) error {
	return g.CanApplication(ctx, action, id)
}

type Persona struct {
	Name string
	Ctx  context.Context
}

func Personas() []Persona {
	as := func(nuid string, roles ...models.UserRole) context.Context {
		return testutil.WithActor(middleware.Actor{NUID: nuid, Roles: roles})
	}
	return []Persona{
		{"admin", as(AdminNUID, models.UserRoleAdmin)},
		{"chief on cycle", as(ChiefNUID, models.UserRoleApplicant)},
		{"chief elsewhere", as(OtherChief, models.UserRoleApplicant)},
		{"lead on cycle", as(LeadNUID, models.UserRoleApplicant)},
		{"applicant", as(ApplicantNUID, models.UserRoleApplicant)},
		{"unauthenticated", context.Background()},
	}
}

type Caller struct {
	Name  string
	Actor *middleware.Actor
}

var (
	Admin          = Caller{"admin", &middleware.Actor{NUID: AdminNUID, Roles: []models.UserRole{models.UserRoleAdmin}}}
	ChiefOnCycle   = Caller{"chief on cycle", &middleware.Actor{NUID: ChiefNUID, Roles: []models.UserRole{models.UserRoleApplicant}}}
	ChiefElsewhere = Caller{"chief elsewhere", &middleware.Actor{NUID: OtherChief, Roles: []models.UserRole{models.UserRoleApplicant}}}
	LeadOnCycle    = Caller{"lead on cycle", &middleware.Actor{NUID: LeadNUID, Roles: []models.UserRole{models.UserRoleApplicant}}}
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
			CycleID:      open(map[string]models.CycleStaffRole{ChiefNUID: models.CycleStaffChief, LeadNUID: models.CycleStaffLead}),
			OtherCycleID: open(map[string]models.CycleStaffRole{OtherChief: models.CycleStaffChief}),
		},
		Applications: map[string]access.StaticApplication{
			ApplicationID: {CycleID: CycleID, Owner: ApplicantNUID, Stage: models.StageInterview},
		},
	}
}

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
