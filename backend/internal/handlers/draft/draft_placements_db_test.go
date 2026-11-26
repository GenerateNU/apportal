package draft

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func TestPlacementsStayHiddenAndUnacceptedUntilTheDraftStarts(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	branch, cycle, role := uuid.NewString(), uuid.NewString(), uuid.NewString()
	chief := "t" + uuid.NewString()[:12]
	exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, 'Chief')", chief, chief+"@test.example")
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	if err := workflow.EnsureSteps(db, cycle); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer')", role, cycle)
	exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'chief')", cycle, chief)
	exec("INSERT INTO preference_lists (cycle_id, name, created_by) VALUES (?, 'Team A', ?), (?, 'Team B', ?)", cycle, chief, cycle, chief)

	apps := make([]string, 5)
	for i := range apps {
		nuid := "t" + uuid.NewString()[:12]
		apps[i] = uuid.NewString()
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", nuid, nuid+"@test.example", nuid)
		exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, ?, 'selection', now())", apps[i], cycle, nuid, role)
	}
	stageOf := func(app string) string {
		t.Helper()
		var stage string
		if err := db.Raw("SELECT stage FROM applications WHERE id = ?", app).Scan(&stage).Error; err != nil {
			t.Fatal(err)
		}
		return stage
	}

	store := NewDraftDB(db)
	ctx := context.Background()
	draft, err := store.CreateDraft(ctx, cycle, role, 1, true, chief)
	if err != nil {
		t.Fatal(err)
	}
	for slot := 1; slot <= PlacementRounds*2; slot++ {
		if _, err := store.MakeDraftPick(ctx, draft, slot, apps[slot-1], chief); err != nil {
			t.Fatalf("placing slot %d: %v", slot, err)
		}
	}
	for _, app := range apps[:4] {
		if got := stageOf(app); got != "selection" {
			t.Fatalf("placed applicant moved to %q before the draft started", got)
		}
	}
	t.Log("4 placed during setup: still in selection")

	hidden, err := store.DraftedApplicationIDs(ctx, cycle, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(hidden) != 0 {
		t.Fatalf("leads see unreleased placements: %v", hidden)
	}
	everyone, err := store.DraftedApplicationIDs(ctx, cycle, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(everyone) != 4 {
		t.Fatalf("chiefs should see all 4 placements, got %d", len(everyone))
	}

	draft, err = store.SetPlacementsReleased(ctx, draft.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	if draft.PlacementsReleasedAt == nil {
		t.Fatal("release didn't stamp placements_released_at")
	}
	shown, err := store.DraftedApplicationIDs(ctx, cycle, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(shown) != 4 {
		t.Fatalf("after release leads should see 4, got %d", len(shown))
	}
	t.Log("released: leads see the 4 placements")

	active := models.DraftActive
	draft, err = store.StartDraft(ctx, draft.ID, DraftUpdate{Status: &active})
	if err != nil {
		t.Fatal(err)
	}
	for _, app := range apps[:4] {
		if got := stageOf(app); got != "accepted" {
			t.Fatalf("placed applicant is %q after the start, want accepted", got)
		}
	}
	board, err := store.DraftBoard(ctx, draft)
	if err != nil {
		t.Fatal(err)
	}
	if board.PlacementRounds != PlacementRounds || board.OnTheClock != PlacementRounds*2+1 {
		t.Fatalf("placement rounds %d, on the clock %d; want %d and %d", board.PlacementRounds, board.OnTheClock, PlacementRounds, PlacementRounds*2+1)
	}
	t.Logf("started: placements accepted, slot %d on the clock", board.OnTheClock)

	if _, err := store.MakeDraftPick(ctx, draft, 0, apps[4], chief); err != nil {
		t.Fatal(err)
	}
	if got := stageOf(apps[4]); got != "accepted" {
		t.Fatalf("a live pick should accept right away, got %q", got)
	}

	if err := store.ResetDraft(ctx, draft.ID); err != nil {
		t.Fatal(err)
	}
	for _, app := range apps {
		if got := stageOf(app); got != "selection" {
			t.Fatalf("reset left an applicant in %q", got)
		}
	}
	reset, err := store.GetDraftByID(ctx, draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if reset.Status != models.DraftSetup || reset.PlacementsReleasedAt != nil {
		t.Fatalf("reset should return to unreleased setup, got %s released=%v", reset.Status, reset.PlacementsReleasedAt)
	}
	t.Log("reset: everyone back in selection, placements unreleased")
}
