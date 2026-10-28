package application

import (
	"encoding/json"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ApplicationOutput struct {
	Body models.Application
}

// ApplicationsOutput is an envelope rather than a bare array because paging
// happens in SQL: a page of rows says nothing about how many matched, and the
// stage tabs need their own counts. Unpaged callers read `applications` and
// ignore the rest.
type ApplicationsOutput struct {
	Body struct {
		Applications []models.ApplicationSummary `json:"applications"`
		// Total is every row matching the filter, not just this page.
		Total int `json:"total"`
		// StageCounts is the same match broken down by stage, ignoring any
		// stage filter, so each tab can show a live count.
		StageCounts map[string]int `json:"stage_counts"`
	}
}

type CreateApplicationInput struct {
	Body struct {
		CycleID      string          `json:"cycle_id" minLength:"1"`
		Role         models.Role     `json:"role"`
		Availability json.RawMessage `json:"availability,omitempty"`
		ResumeURL    *string         `json:"resume_url,omitempty"`
	}
}

type ApplicationIDInput struct {
	ID string `path:"id"`
}

type ListApplicationsInput struct {
	CycleID    string `query:"cycle_id"`
	UserNUID   string `query:"user_nuid"`
	AssignedTo string `query:"assigned_to" doc:"Limit to applications this lead is assigned to review"`
	// InterviewerNUID is the interview-side counterpart of AssignedTo: the
	// reviewer's own "interviews assigned to me" queue.
	InterviewerNUID string `query:"interviewer_nuid" doc:"Limit to applications this reviewer is assigned to interview"`
	// RecordingReviewerNUID is the recording-review counterpart of
	// InterviewerNUID: the lead's own "interviews assigned to me to review" queue.
	RecordingReviewerNUID string `query:"recording_reviewer_nuid" doc:"Limit to applications this lead is assigned to review the interview recording of"`
	Role                  string `query:"role"`
	// Roles is the any-of counterpart of Role, for the filter menu's
	// multi-select. Comma-separated for the same reason as RatingFilters.
	Roles string `query:"roles" doc:"Comma-separated list of applicant roles, e.g. \"software_engineer,software_designer\"; an application matches any of them"`
	Stage string `query:"stage"`
	// Stages is the any-of counterpart of Stage, for the filter menu's
	// multi-select. Comma-separated for the same reason as RatingFilters.
	Stages string `query:"stages" doc:"Comma-separated list of stages, e.g. \"accepted,rejected\"; an application matches any of them"`
	// AnswerFilters is a JSON-encoded []AnswerFilterInput rather than a
	// structured param because huma can only bind primitives from a query
	// string — a []AnswerFilterInput field silently binds nothing (or panics,
	// depending on how the client serializes it).
	AnswerFilters string `query:"answer_filters" doc:"JSON array of answer filters, e.g. [{\"question_id\":\"…\",\"question_type\":\"checkbox\",\"values\":[\"Yes\"]}]. Use question_ids for a question authored once per applicant role. Values may be a string or an array of strings; a filter matches any of them, and separate filters are AND'd."`
	// RatingFilters is a comma-separated list of interview ratings to filter by,
	// e.g. "must_hire,great". Applications match if their interview has any of
	// these ratings.
	RatingFilters string `query:"rating_filters" doc:"Comma-separated list of interview ratings, e.g. \"must_hire,great\""`
	// Returner is a string rather than a bool so an omitted param stays
	// distinguishable from an explicit "false" (show only first-timers).
	Returner string `query:"returner" doc:"\"true\" for applicants who worked on a Generate project before, \"false\" for first-timers; omit for both" enum:"true,false"`
	Search   string `query:"search" doc:"Case-insensitive substring match on the applicant's name, NUID, or email"`
	Limit    int    `query:"limit" doc:"Max results per page; omit (or 0) to return every match" minimum:"0" maximum:"200"`
	Offset   int    `query:"offset" doc:"Number of results to skip" minimum:"0"`
}

type UpdateApplicationInput struct {
	ID   string `path:"id"`
	Body struct {
		Stage        *models.ApplicationStage `json:"stage,omitempty"`
		Availability json.RawMessage          `json:"availability,omitempty"`
		ResumeURL    *string                  `json:"resume_url,omitempty"`
	}
}
