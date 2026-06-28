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
	StageLeadReview         ApplicationStage = "lead_review"
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
	case StageSubmitted, StageLeadReview, StageChiefReview, StageInterviewScheduled,
		StageInterviewConducted, StageInterviewReview, StageSelection,
		StageAccepted, StageRejected, StageWithdrawn:
		return true
	}
	return false
}

// UserRole is a role a user can hold. Users carry an array of these (a user can
// be both an applicant and a reviewer), replacing the old scalar reviewer_role.
type UserRole string

const (
	UserRoleApplicant UserRole = "applicant"
	UserRoleMember    UserRole = "member"
	UserRoleLead      UserRole = "lead"
	UserRoleChief     UserRole = "chief"
	UserRoleAdmin     UserRole = "admin"
)

func (r UserRole) Valid() bool {
	switch r {
	case UserRoleApplicant, UserRoleMember, UserRoleLead, UserRoleChief, UserRoleAdmin:
		return true
	}
	return false
}

// ApplicationType is what a cycle is recruiting for.
type ApplicationType string

const (
	ApplicationTypeMember ApplicationType = "member"
	ApplicationTypeLead   ApplicationType = "lead"
	ApplicationTypeChief  ApplicationType = "chief"
)

func (t ApplicationType) Valid() bool {
	switch t {
	case ApplicationTypeMember, ApplicationTypeLead, ApplicationTypeChief:
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
