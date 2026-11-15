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
