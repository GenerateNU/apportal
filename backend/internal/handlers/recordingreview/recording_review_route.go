package recordingreview

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	interviewAssignmentDB := interviewassignment.NewInterviewAssignmentDB(db)
	interviewDB := interview.NewInterviewDB(db)
	recordingReviewDB := NewRecordingReviewDB(db)
	reviewReleaseDB := reviewrelease.NewReviewReleaseDB(db)
	s := &recordingReviewService{interviewDB: interviewDB, interviewAssignmentDB: interviewAssignmentDB, recordingReviewDB: recordingReviewDB, reviewReleaseDB: reviewReleaseDB}

	huma.Register(api, huma.Operation{
		OperationID: "upsert-recording-review",
		Method:      http.MethodPut,
		Path:        "/interviews/{id}/recording-review",
		Summary:     "Submit or update your interview recording review",
		Description: "Reviewer only; upserts the calling reviewer's review of the recording.",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-recording-reviews",
		Method:      http.MethodGet,
		Path:        "/interviews/{id}/recording-reviews",
		Summary:     "List an interview's recording reviews",
		Description: "Leads see only their own review until a chief releases the cycle's recording reviews; chiefs and admins always see every review.",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "list-recording-reviews-bulk",
		Method:      http.MethodGet,
		Path:        "/recording-reviews",
		Summary:     "List recording reviews for several interviews",
		Description: "Reviewer only. One request for a page of applications, instead of one per interview. Comments are always omitted here — this is for computing review-progress counts, not reading review content; use list-recording-reviews for that.",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.listBulk)
}
