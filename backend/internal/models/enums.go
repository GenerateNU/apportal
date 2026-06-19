package models

// Enum types mirror the Postgres ENUMs defined in the init migration.
// They are plain strings so they encode/decode cleanly to JSON and SQL.

type Role string

const (
	RoleSoftwareEngineer Role = "software_engineer"
	RoleSoftwareDesigner Role = "software_designer"
)

func (r Role) Valid() bool {
	switch r {
	case RoleSoftwareEngineer, RoleSoftwareDesigner:
		return true
	}
	return false
}

type ApplicationStage string

const (
	StageSubmitted          ApplicationStage = "submitted"
	StageTLReview           ApplicationStage = "tl_review"
	StageChiefReview        ApplicationStage = "chief_review"
	StageInterviewScheduled ApplicationStage = "interview_scheduled"
	StageInterviewConducted ApplicationStage = "interview_conducted"
	StageInterviewReview    ApplicationStage = "interview_review"
	StageSelection          ApplicationStage = "selection"
	StageAccepted           ApplicationStage = "accepted"
	StageRejected           ApplicationStage = "rejected"
	StageWithdrawn          ApplicationStage = "withdrawn"
)

func (s ApplicationStage) Valid() bool {
	switch s {
	case StageSubmitted, StageTLReview, StageChiefReview, StageInterviewScheduled,
		StageInterviewConducted, StageInterviewReview, StageSelection,
		StageAccepted, StageRejected, StageWithdrawn:
		return true
	}
	return false
}

type ReviewerRole string

const (
	ReviewerRoleTL    ReviewerRole = "tl"
	ReviewerRoleChief ReviewerRole = "chief"
)

func (r ReviewerRole) Valid() bool {
	switch r {
	case ReviewerRoleTL, ReviewerRoleChief:
		return true
	}
	return false
}

type QuestionType string

const (
	QuestionShortAnswer    QuestionType = "short_answer"
	QuestionLongAnswer     QuestionType = "long_answer"
	QuestionMultipleChoice QuestionType = "multiple_choice"
	QuestionCheckbox       QuestionType = "checkbox"
	QuestionURL            QuestionType = "url"
)

func (q QuestionType) Valid() bool {
	switch q {
	case QuestionShortAnswer, QuestionLongAnswer, QuestionMultipleChoice,
		QuestionCheckbox, QuestionURL:
		return true
	}
	return false
}

type CycleStatus string

const (
	CycleDraft    CycleStatus = "draft"
	CycleOpen     CycleStatus = "open"
	CycleClosed   CycleStatus = "closed"
	CycleArchived CycleStatus = "archived"
)

func (c CycleStatus) Valid() bool {
	switch c {
	case CycleDraft, CycleOpen, CycleClosed, CycleArchived:
		return true
	}
	return false
}
