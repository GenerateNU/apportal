package reviewrelease

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestPeerReviewsVisibleWithoutActor(t *testing.T) {
	var r *ReviewReleaseDB
	_, err := r.PeerReviewsVisible(context.Background(), &access.Checker{}, models.ReviewKindWritten, []string{"a1"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestPeerReviewsVisibleNoIDs(t *testing.T) {
	var r *ReviewReleaseDB
	ctx := testutil.WithActor(middleware.Actor{NUID: "l1"})
	got, err := r.PeerReviewsVisible(ctx, &access.Checker{}, models.ReviewKindWritten, nil)
	if err != nil || len(got) != 0 {
		t.Fatalf("got %v, %v; want an empty map without querying", got, err)
	}
}

func TestHidePeerWriteups(t *testing.T) {
	note := "solid answers"
	row := func(app, nuid string) models.InterviewReviewerDetail {
		r := models.InterviewReviewerDetail{ApplicationID: app}
		r.ReviewerNUID, r.Writeup = nuid, &note
		return r
	}
	items := []models.InterviewReviewerDetail{
		row("a1", "l1"), row("a1", "l2"), // a1 not released: l2's write-up goes
		row("a2", "l1"), row("a2", "l2"), // a2 released: both stay
	}
	hid := HidePeerWriteups(items, "l1", map[string]bool{"a2": true})
	if !hid {
		t.Error("hid = false, want true")
	}
	for i, want := range []bool{true, false, true, true} {
		if got := items[i].Writeup != nil; got != want {
			t.Errorf("row %d: has write-up = %v, want %v", i, got, want)
		}
	}
	if HidePeerWriteups(items[2:], "l1", map[string]bool{"a2": true}) {
		t.Error("nothing to hide, but reported hiding")
	}
}
