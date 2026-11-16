package staffgroup

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const maxMembers = 200

type GroupMember struct {
	GroupID  string `json:"-"`
	UserNUID string `json:"user_nuid"`
	FullName string `json:"full_name"`
}

type StaffGroup struct {
	ID        string        `json:"id"`
	CycleID   string        `json:"cycle_id"`
	Name      string        `json:"name"`
	CreatedAt time.Time     `json:"created_at"`
	Members   []GroupMember `json:"members"`
}

type GroupsOutput struct {
	Body []StaffGroup
}

type GroupOutput struct {
	Body StaffGroup
}

type CreateGroupInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Name        string   `json:"name" minLength:"1" maxLength:"100"`
		MemberNUIDs []string `json:"member_nuids,omitempty" maxItems:"200" doc:"Must be on the cycle's staff"`
	}
}

type GroupPathInput struct {
	ID      string `path:"id" doc:"Cycle ID"`
	GroupID string `path:"group_id"`
}

type RenameGroupInput struct {
	ID      string `path:"id" doc:"Cycle ID"`
	GroupID string `path:"group_id"`
	Body    struct {
		Name string `json:"name" minLength:"1" maxLength:"100"`
	}
}

type MemberPathInput struct {
	ID      string `path:"id" doc:"Cycle ID"`
	GroupID string `path:"group_id"`
	NUID    string `path:"nuid"`
}

type OpeningTeam struct {
	RoleID   string           `json:"role_id"`
	Kind     models.StaffKind `json:"kind"`
	GroupIDs []string         `json:"group_ids"`
}

type OpeningTeamsOutput struct {
	Body []OpeningTeam
}

type OpeningTeamOutput struct {
	Body OpeningTeam
}

type SetOpeningTeamInput struct {
	ID     string           `path:"id" doc:"Cycle ID"`
	RoleID string           `path:"role_id"`
	Kind   models.StaffKind `path:"kind"`
	Body   struct {
		GroupIDs []string `json:"group_ids" maxItems:"50" doc:"Empty means everyone on the cycle's staff"`
	}
}
