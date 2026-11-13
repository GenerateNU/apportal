package interviewgroup

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
)

func Route(api huma.API, db *gorm.DB) {
	s := &interviewGroupService{
		groupDB:               NewInterviewGroupDB(db),
		applicationDB:         application.NewApplicationDB(db),
		interviewAssignmentDB: interviewassignment.NewInterviewAssignmentDB(db),
	}

	huma.Register(api, huma.Operation{
		OperationID: "list-interview-groups",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/interview-groups",
		Summary:     "List a cycle's interview groups",
		Description: "Chief only. Members are included.",
		Tags:        []string{"Interview groups"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-interview-group",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/interview-groups",
		Summary:       "Create an interview group",
		Description:   "Chief only. Names are unique within a cycle.",
		Tags:          []string{"Interview groups"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-interview-group",
		Method:      http.MethodPut,
		Path:        "/interview-groups/{id}",
		Summary:     "Replace an interview group's name, meeting slot, and members",
		Description: "Chief only. Interviewers already assigned from this group are left alone.",
		Tags:        []string{"Interview groups"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-interview-group",
		Method:        http.MethodDelete,
		Path:          "/interview-groups/{id}",
		Summary:       "Delete an interview group",
		Description:   "Chief only. Interviewers already assigned from this group are left alone.",
		Tags:          []string{"Interview groups"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.delete)

	huma.Register(api, huma.Operation{
		OperationID: "assign-interview-group",
		Method:      http.MethodPost,
		Path:        "/applications/{id}/interview-groups/{groupId}",
		Summary:     "Add every member of a group as an interviewer",
		Description: "Chief only. Members already interviewing the application are skipped. " +
			"The group is a preset: interviewers can be added or removed individually afterwards.",
		Tags:   []string{"Interview groups"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.assign)
}
