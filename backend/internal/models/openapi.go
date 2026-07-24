package models

import "github.com/danielgtaylor/huma/v2"

// The enum types implement huma.SchemaProvider so that, wherever they appear in
// request/response bodies, the generated OpenAPI renders them as a string with
// an explicit `enum` list rather than a plain string.

func enumSchema(values ...string) *huma.Schema {
	enum := make([]any, len(values))
	for i, v := range values {
		enum[i] = v
	}
	return &huma.Schema{Type: huma.TypeString, Enum: enum}
}

func (Role) Schema(huma.Registry) *huma.Schema {
	return enumSchema(string(RoleSoftwareEngineer), string(RoleSoftwareDesigner))
}

func (ApplicationStage) Schema(huma.Registry) *huma.Schema {
	return enumSchema(
		string(StageDraft), string(StageSubmitted), string(StageLeadReview), string(StageChiefReview),
		string(StageInterviewScheduled), string(StageInterviewConducted),
		string(StageInterviewReview), string(StageSelection),
		string(StageAccepted), string(StageRejected), string(StageWithdrawn),
	)
}

func (UserRole) Schema(huma.Registry) *huma.Schema {
	return enumSchema(
		string(UserRoleApplicant), string(UserRoleMember), string(UserRoleLead),
		string(UserRoleChief), string(UserRoleAdmin),
	)
}

func (ApplicationType) Schema(huma.Registry) *huma.Schema {
	return enumSchema(
		string(ApplicationTypeMember), string(ApplicationTypeLead), string(ApplicationTypeChief),
	)
}

func (InterviewRating) Schema(huma.Registry) *huma.Schema {
	return enumSchema(
		string(RatingDoNotHire), string(RatingGood), string(RatingGreat), string(RatingMustHire),
	)
}

func (QuestionType) Schema(huma.Registry) *huma.Schema {
	return enumSchema(
		string(QuestionShortAnswer), string(QuestionLongAnswer),
		string(QuestionMultipleChoice), string(QuestionCheckbox),
		string(QuestionDropdown), string(QuestionURL),
	)
}

func (CycleStatus) Schema(huma.Registry) *huma.Schema {
	return enumSchema(
		string(CycleDraft), string(CycleOpen), string(CycleClosed), string(CycleArchived),
	)
}
