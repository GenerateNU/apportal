package workflow

import (
	"slices"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type State string

const (
	StateDraft  State = "draft"
	StateOpen   State = "open"
	StateClosed State = "closed"
)

func (State) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Enum: []any{string(StateDraft), string(StateOpen), string(StateClosed)}}
}

type Status string

const (
	StatusLocked Status = "locked"
	StatusOpen   Status = "open"
	StatusDone   Status = "done"
)

func (Status) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Enum: []any{string(StatusLocked), string(StatusOpen), string(StatusDone)}}
}

type Deadline struct {
	Kind  models.StepKind
	DueAt time.Time
	Hard  bool
}

type Opening struct {
	RoleID string
	Name   string
}

type key struct {
	role string
	step models.Step
}

type CycleState struct {
	Order       []models.Step
	CycleID     string
	Enabled     map[models.Step]bool
	CompletedAt map[models.Step]*time.Time
	Assignments map[models.Step]map[models.StepKind]int
	Openings    []Opening
	Releases    map[key]time.Time
	Deadlines   map[key]map[models.StepKind]Deadline
	MovedInto   map[key]bool
	Counts      map[key]int
	AnyMove     bool
	// PeersReleased marks openings whose reviewers may see each other's reviews for a step.
	PeersReleased map[key]bool
	Missing       map[key][]missingSetup
	HasTeam       bool
	// Reviews is how far written reviews have got, loaded for the overview's page locks.
	Reviews ReviewProgress
	// Assigned counts reviewer and interviewer assignments per opening, for the release rule.
	Assigned map[key]int
	// Submitted counts finished written reviews per opening.
	Submitted map[key]int
}

type ReviewProgress struct {
	Assigned  int
	Submitted int
}

func NewCycleState(cycleID string) *CycleState {
	f := &CycleState{
		CycleID:     cycleID,
		Order:       DefaultOrder(),
		Enabled:     map[models.Step]bool{},
		CompletedAt: map[models.Step]*time.Time{},
		Assignments: map[models.Step]map[models.StepKind]int{},
		Releases:    map[key]time.Time{},
		Deadlines:   map[key]map[models.StepKind]Deadline{},
		MovedInto:   map[key]bool{},
		Assigned:    map[key]int{},
		Submitted:   map[key]int{},
		Counts:      map[key]int{},

		PeersReleased: map[key]bool{},
		Missing:       map[key][]missingSetup{},
	}
	for _, s := range f.Order {
		f.Enabled[s] = true
	}
	return f
}

func (f *CycleState) SetRelease(role string, s models.Step, at time.Time) {
	f.Releases[key{role, s}] = at
}

func (f *CycleState) SetDeadline(role string, s models.Step, d Deadline) {
	k := key{role, s}
	if f.Deadlines[k] == nil {
		f.Deadlines[k] = map[models.StepKind]Deadline{}
	}
	f.Deadlines[k][d.Kind] = d
}

func (f *CycleState) SetAssignment(s models.Step, k models.StepKind, n int) {
	if f.Assignments[s] == nil {
		f.Assignments[s] = map[models.StepKind]int{}
	}
	f.Assignments[s][k] = n
}

func (f *CycleState) AddMove(role string, to models.ApplicationStage) {
	if s, ok := StepOfStage(to); ok {
		f.MovedInto[key{role, s}] = true
		f.AnyMove = true
	}
}

func (f *CycleState) AddCount(role string, stage models.ApplicationStage, n int) {
	if s, ok := StepOfStage(stage); ok {
		f.Counts[key{role, s}] += n
	}
}

func (f *CycleState) EnabledSteps() []models.Step {
	out := []models.Step{}
	for _, s := range f.Order {
		if f.Enabled[s] {
			out = append(out, s)
		}
	}
	return out
}

func (f *CycleState) Next(s models.Step) (models.Step, bool) {
	steps := f.EnabledSteps()
	i := slices.Index(steps, s)
	if i < 0 || i+1 >= len(steps) {
		return "", false
	}
	return steps[i+1], true
}

func (f *CycleState) Prev(s models.Step) (models.Step, bool) {
	steps := f.EnabledSteps()
	i := slices.Index(steps, s)
	if i <= 0 {
		return "", false
	}
	return steps[i-1], true
}

func (f *CycleState) RoleName(role string) string {
	for _, o := range f.Openings {
		if o.RoleID == role {
			return o.Name
		}
	}
	return role
}

func (f *CycleState) ReleasedAt(role string, s models.Step) (time.Time, bool) {
	t, ok := f.Releases[key{role, s}]
	return t, ok
}

func (f *CycleState) Released(role string, s models.Step) bool {
	_, ok := f.ReleasedAt(role, s)
	return ok
}

func (f *CycleState) Deadline(role string, s models.Step, k models.StepKind) (Deadline, bool) {
	d, ok := f.Deadlines[key{role, s}][k]
	return d, ok
}

func (f *CycleState) Count(role string, s models.Step) int { return f.Counts[key{role, s}] }

func (f *CycleState) StepCount(s models.Step) int {
	n := 0
	for _, o := range f.Openings {
		n += f.Count(o.RoleID, s)
	}
	return n
}

func deriveState(released bool, main *Deadline, now time.Time) State {
	switch {
	case !released:
		return StateDraft
	case main != nil && !now.Before(main.DueAt):
		return StateClosed
	}
	return StateOpen
}

func (f *CycleState) State(role string, s models.Step, now time.Time) State {
	var main *Deadline
	if k, ok := MainKind(s); ok {
		if d, ok := f.Deadline(role, s, k); ok {
			main = &d
		}
	}
	return deriveState(f.Released(role, s), main, now)
}

// Started is a step under way for an opening. Outcomes (a rejection mid-cycle) don't start a step reached by outcome.
func (f *CycleState) Started(role string, s models.Step) bool {
	if f.Released(role, s) {
		return true
	}
	t, _ := TypeOf(s)
	return !t.ByOutcome && f.MovedInto[key{role, s}]
}

func (f *CycleState) StartedAnywhere(s models.Step) bool {
	for k := range f.Releases {
		if k.step == s {
			return true
		}
	}
	for k, moved := range f.MovedInto {
		if moved && k.step == s {
			return true
		}
	}
	return false
}

func (f *CycleState) Frozen(role string, s models.Step) bool {
	next, ok := f.Next(s)
	return ok && f.Started(role, next)
}

// Ready is a step being over for an opening: past its deadline, or with nothing left to do.
func (f *CycleState) Ready(role string, s models.Step, now time.Time) bool {
	if _, ok := MainKind(s); !ok {
		return f.Released(role, s)
	}
	if f.State(role, s, now) == StateClosed {
		return true
	}
	return s == models.StepReviews && f.Released(role, s) && f.allReviewsIn(role)
}

func (f *CycleState) allReviewsIn(role string) bool {
	k := key{role, models.StepReviews}
	return f.Assigned[k] > 0 && f.Submitted[k] >= f.Assigned[k]
}

func (f *CycleState) Done(s models.Step) bool { return f.CompletedAt[s] != nil }

func (f *CycleState) Current() (models.Step, bool) {
	for _, s := range f.EnabledSteps() {
		if !f.Done(s) {
			return s, true
		}
	}
	return "", false
}

// SetUp is whether the cycle has a position and a recruitment team, which every step waits on.
func (f *CycleState) SetUp() bool { return len(f.Openings) > 0 && f.HasTeam }

func (f *CycleState) StepStatus(s models.Step) Status {
	if f.Done(s) {
		return StatusDone
	}
	if !f.SetUp() {
		return StatusLocked
	}
	// An outcome (a rejection, say) can land at any point, so it doesn't open a step reached by outcome.
	t, _ := TypeOf(s)
	if cur, ok := f.Current(); (ok && cur == s) || (!t.ByOutcome && f.StartedAnywhere(s)) {
		return StatusOpen
	}
	return StatusLocked
}

func (f *CycleState) AllDone() bool {
	_, ok := f.Current()
	return !ok
}

func EnsureSteps(db *gorm.DB, cycleID string) error {
	order := DefaultOrder()
	rows := make([]models.CycleStep, 0, len(order))
	for i, s := range order {
		rows = append(rows, models.CycleStep{CycleID: cycleID, Step: s, Enabled: true, Position: i})
	}
	return db.Select("cycle_id", "step", "enabled", "position").Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

func lockCycle(tx *gorm.DB, cycleID string) error {
	if err := EnsureSteps(tx, cycleID); err != nil {
		return err
	}
	var steps []models.CycleStep
	return tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("cycle_id = ?", cycleID).Find(&steps).Error
}

// HoldCycle makes releases and advances wait for tx without blocking other holders.
func HoldCycle(tx *gorm.DB, cycleID string) error {
	if err := EnsureSteps(tx, cycleID); err != nil {
		return err
	}
	var steps []models.CycleStep
	return tx.Clauses(clause.Locking{Strength: "SHARE"}).Where("cycle_id = ?", cycleID).Find(&steps).Error
}

func Load(db *gorm.DB, cycleID string) (*CycleState, error) {
	f := NewCycleState(cycleID)

	var steps []models.CycleStep
	if err := db.Where("cycle_id = ?", cycleID).Order("position").Find(&steps).Error; err != nil {
		return nil, err
	}
	f.applySteps(steps)

	var assignments []models.StepAssignment
	if err := db.Where("cycle_id = ?", cycleID).Find(&assignments).Error; err != nil {
		return nil, err
	}
	for _, a := range assignments {
		f.SetAssignment(a.Step, a.Kind, a.PerApplicant)
	}
	for _, t := range stepTypes {
		for k, n := range t.DefaultCounts {
			if _, set := f.Assignments[t.Step][k]; !set {
				f.SetAssignment(t.Step, k, n)
			}
		}
	}

	if err := db.Model(&models.Role{}).Select("id AS role_id, name").Where("cycle_id = ?", cycleID).
		Order("name").Order("id").Scan(&f.Openings).Error; err != nil {
		return nil, err
	}

	var staff int64
	if err := db.Table("(?) AS p", StaffPool(db, cycleID)).Limit(1).Count(&staff).Error; err != nil {
		return nil, err
	}
	f.HasTeam = staff > 0

	var assigned []struct {
		RoleID string
		Step   models.Step
		N      int
		Done   int
	}
	if err := db.Raw(`SELECT a.role_id, ? AS step, count(*) AS n, count(w.submitted_at) AS done FROM lead_assignments la
			JOIN applications a ON a.id = la.application_id
			LEFT JOIN written_reviews w ON w.application_id = la.application_id AND w.reviewer_nuid = la.lead_nuid
			WHERE a.cycle_id = ? GROUP BY a.role_id
		UNION ALL
		SELECT a.role_id, ? AS step, count(*) AS n, 0 AS done FROM interviewers x
			JOIN interviews i ON i.id = x.interview_id JOIN applications a ON a.id = i.application_id
			WHERE a.cycle_id = ? GROUP BY a.role_id`,
		models.StepReviews, cycleID, models.StepInterviews, cycleID).Scan(&assigned).Error; err != nil {
		return nil, err
	}
	for _, r := range assigned {
		f.Assigned[key{r.RoleID, r.Step}] = r.N
		f.Submitted[key{r.RoleID, r.Step}] = r.Done
	}

	var releases []models.OpeningStep
	if err := db.Where("cycle_id = ? AND released_at IS NOT NULL", cycleID).Find(&releases).Error; err != nil {
		return nil, err
	}
	for _, r := range releases {
		f.SetRelease(r.RoleID, r.Step, *r.ReleasedAt)
	}

	var deadlines []models.OpeningDeadline
	if err := db.Where("cycle_id = ?", cycleID).Find(&deadlines).Error; err != nil {
		return nil, err
	}
	for _, d := range deadlines {
		f.SetDeadline(d.RoleID, d.Step, Deadline{Kind: d.Kind, DueAt: d.DueAt, Hard: d.Hard})
	}

	var moves []struct {
		RoleID  string
		ToStage models.ApplicationStage
	}
	if err := db.Table("application_moves m").Select("a.role_id, m.to_stage").
		Joins("JOIN applications a ON a.id = m.application_id").
		Where("a.cycle_id = ? AND m.undone_at IS NULL", cycleID).
		Group("a.role_id, m.to_stage").Scan(&moves).Error; err != nil {
		return nil, err
	}
	for _, m := range moves {
		f.AddMove(m.RoleID, m.ToStage)
	}

	var counts []struct {
		RoleID string
		Stage  models.ApplicationStage
		N      int
	}
	if err := db.Model(&models.Application{}).Select("role_id, stage, count(*) AS n").
		Where("cycle_id = ?", cycleID).Group("role_id, stage").Scan(&counts).Error; err != nil {
		return nil, err
	}
	for _, c := range counts {
		f.AddCount(c.RoleID, c.Stage, c.N)
	}

	var peers []models.ReviewRelease
	if err := db.Select("role_id", "review_kind").Where("cycle_id = ?", cycleID).Find(&peers).Error; err != nil {
		return nil, err
	}
	for _, r := range peers {
		f.PeersReleased[key{r.RoleID, reviewStep(r.ReviewKind)}] = true
	}
	return f, nil
}

func inTx(db *gorm.DB, cycleID string, fn func(tx *gorm.DB, f *CycleState) error) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := lockCycle(tx, cycleID); err != nil {
			return err
		}
		f, err := Load(tx, cycleID)
		if err != nil {
			return err
		}
		return fn(tx, f)
	})
}

func (f *CycleState) applySteps(steps []models.CycleStep) {
	if len(steps) == len(stepTypes) {
		f.Order = make([]models.Step, len(steps))
		for i, s := range steps {
			f.Order[i] = s.Step
		}
	}
	for _, s := range steps {
		f.Enabled[s.Step] = s.Enabled
		f.CompletedAt[s.Step] = s.CompletedAt
	}
}
