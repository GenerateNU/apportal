package cycleworkflow

import (
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestAdvanceBeforeDeadlineNeedsEveryReview(t *testing.T) {
	f := newFixture(t)
	f.openApps(f.roleA)
	for _, a := range f.apps {
		f.assignReviewer(a)
	}
	f.passApps(f.roleA, f.apps...)
	f.complete(models.StepApplications)
	f.openReviews(f.roleA)
	f.submitReviews(f.apps[0])
	_, err := f.advance(f.confirmed(f.chiefA), models.StepReviews, &f.roleA, f.apps...)
	testutil.WantStatus(t, err, http.StatusConflict)
	f.submitReviews(f.apps[1])
	_, err = f.advance(f.confirmed(f.chiefA), models.StepReviews, &f.roleA, f.apps...)
	f.must(err)
}
