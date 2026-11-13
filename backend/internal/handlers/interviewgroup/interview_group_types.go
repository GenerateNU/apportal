package interviewgroup

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type GroupBody struct {
	Name        string     `json:"name" minLength:"1"`
	MeetingSlot *time.Time `json:"meeting_slot,omitempty"`
	MemberNUIDs []string   `json:"member_nuids"`
}

type CreateGroupInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body GroupBody
}

type UpdateGroupInput struct {
	ID   string `path:"id" doc:"Interview group ID"`
	Body GroupBody
}

type GroupOutput struct {
	Body models.InterviewGroupDetail
}

type GroupsOutput struct {
	Body []models.InterviewGroupDetail
}

type AssignGroupInput struct {
	ID      string `path:"id" doc:"Application ID"`
	GroupID string `path:"groupId" doc:"Interview group ID"`
}

type AssignGroupOutput struct {
	Body struct {
		Added        int                        `json:"added"`
		Interviewers []models.InterviewerDetail `json:"interviewers"`
	}
}
