package recordingreview

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	s := &recordingReviewService{
		interviewAssignmentDB: interviewassignment.NewInterviewAssignmentDB(db),
		recordingReviewDB:     NewRecordingReviewDB(db),
		reviewReleaseDB:       reviewrelease.NewReviewReleaseDB(db),
	}

	huma.Register(api, huma.Operation{
		OperationID: "upsert-recording-review",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/interview-review",
		Summary:     "Save your recording review",
		Description: "Assigned recording reviewers only, once every interviewer has submitted. A rating sets the interview's shared rating.",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-interview-reviewers",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview-reviewers",
		Summary:     "List an application's recording reviewers and their reviews",
		Description: "Leads see only their own write-up until a chief releases the cycle's recording reviews; chiefs and admins see every one.",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, s.list)
}
