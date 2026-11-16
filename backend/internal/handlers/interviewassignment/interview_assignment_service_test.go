package interviewassignment

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

var chiefOfApplication = accesstest.Want{
	accesstest.Admin.Name: accesstest.Allow, accesstest.ChiefOnCycle.Name: accesstest.Allow,
	accesstest.ChiefElsewhere.Name: http.StatusNotFound, accesstest.LeadOnCycle.Name: http.StatusForbidden,
	accesstest.Applicant.Name: http.StatusForbidden, accesstest.Anonymous.Name: http.StatusUnauthorized,
}

func service(t *testing.T, gate access.Gate) *interviewAssignmentService {
	db := accesstest.DB(t)
	return &interviewAssignmentService{gate: gate, guard: staffing.NewGuard(db), interviewAssignmentDB: NewInterviewAssignmentDB(db)}
}

func TestAddPermissions(t *testing.T) {
	t.Run("interviewer", func(t *testing.T) {
		accesstest.Run(t, chiefOfApplication, func(ctx context.Context, gate access.Gate) error {
			in := &AddInterviewerInput{ID: accesstest.ApplicationID}
			in.Body.InterviewerNUID = "lead"
			_, err := service(t, gate).addInterviewer(ctx, in)
			return err
		})
	})
	t.Run("recording reviewer", func(t *testing.T) {
		accesstest.Run(t, chiefOfApplication, func(ctx context.Context, gate access.Gate) error {
			in := &AddReviewerInput{ID: accesstest.ApplicationID}
			in.Body.ReviewerNUID = "lead"
			_, err := service(t, gate).addReviewer(ctx, in)
			return err
		})
	})
}

func TestAddRejectsMalformedID(t *testing.T) {
	s := service(t, &accesstest.Recorder{Static: accesstest.Fixture()})
	in := &AddInterviewerInput{ID: "app-1"}
	in.Body.InterviewerNUID = "lead"
	_, err := s.addInterviewer(testutil.WithActor(*accesstest.Admin.Actor), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}
