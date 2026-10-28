package decision

import (
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/recordingreview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/handlers/writtenreview"
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

func Route(api huma.API, db *gorm.DB) {
	decisionDB := NewDecisionDB(db)
	interviewDB := interview.NewInterviewDB(db)
	recordingReviewDB := recordingreview.NewRecordingReviewDB(db)
	reviewReleaseDB := reviewrelease.NewReviewReleaseDB(db)
	writtenReviewDB := writtenreview.NewWrittenReviewDB(db)
	s := &decisionService{decisionDB: decisionDB, interviewDB: interviewDB, recordingReviewDB: recordingReviewDB, reviewReleaseDB: reviewReleaseDB, writtenReviewDB: writtenReviewDB}

	huma.Register(api, huma.Operation{
		OperationID: "list-decision-templates",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/decision-templates",
		Summary:     "A cycle's rejection letter templates for one role",
		Description: "Reviewer only. ?role= selects the role (required). Returns both kinds, creating default-content rows on first access.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.listTemplates)

	huma.Register(api, huma.Operation{
		OperationID: "update-decision-template",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/decision-templates",
		Summary:     "Replace one rejection letter template",
		Description: "Chief only. ?role= and ?kind= select which letter (both required). Replaces subject and body together — there is no partial update.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.updateTemplate)

	huma.Register(api, huma.Operation{
		OperationID: "list-decisions",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/decisions",
		Summary:     "Every applicant in a cycle who is getting a rejection",
		Description: "Reviewer only. Excludes accepted, withdrawn, and unsubmitted applications. Each row carries the applicant, which letter applies, who owes the feedback, and whatever has been written — the page needs no per-applicant follow-up.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "list-decision-context",
		Method:      http.MethodGet,
		Path:        "/decisions/context",
		Summary:     "The review history behind a batch of decisions",
		Description: "Reviewer only. ?application_ids= is comma-separated. Returns each applicant's interview write-up, recording reviews, and lead written reviews — the material an interviewer draws on to write feedback. Blind review still applies: a lead sees only their own written review, and peers' recording comments are withheld, until a chief releases the cycle's reviews. Leads only get applicants they interviewed.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, s.context)

	huma.Register(api, huma.Operation{
		OperationID: "upsert-decision",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/decision",
		Summary:     "Write an applicant's decision feedback",
		Description: "The assigned interviewer may write feedback and compliments for their own applicants. Chiefs may additionally change the kind, override the whole message, and mark it sent.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.upsert)
}
