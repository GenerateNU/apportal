package access

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func TestReadableWithoutActor(t *testing.T) {
	_, err := (&Checker{}).Readable(context.Background(), []string{"a1"}, Review, workflow.WorkWrittenReview)
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestReadableNoIDs(t *testing.T) {
	ctx := testutil.WithActor(middleware.Actor{NUID: "l1"})
	r, err := (&Checker{}).Readable(ctx, nil, Review, workflow.WorkWrittenReview)
	if err != nil || len(r.IDs) != 0 {
		t.Fatalf("got %+v, %v; want nothing without querying", r, err)
	}
}

func TestHidePeerWriteups(t *testing.T) {
	note := "solid answers"
	row := func(app, nuid string) models.InterviewReviewerDetail {
		r := models.InterviewReviewerDetail{ApplicationID: app}
		r.ReviewerNUID, r.Writeup = nuid, &note
		return r
	}
	items := []models.InterviewReviewerDetail{row("a1", "l1"), row("a1", "l2"), row("a2", "l1"), row("a2", "l2")}
	r := Readable{Peers: map[string]bool{"a2": true}}
	if !r.HidePeerWriteups(items, "l1") {
		t.Error("hid = false, want true")
	}
	for i, want := range []bool{true, false, true, true} {
		if got := items[i].Writeup != nil; got != want {
			t.Errorf("row %d: has write-up = %v, want %v", i, got, want)
		}
	}
	if r.HidePeerWriteups(items[2:], "l1") {
		t.Error("nothing to hide, but reported hiding")
	}
}
