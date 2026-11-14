package interviewgroup

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
)

func Route(api huma.API, db *gorm.DB) {
	s := &interviewGroupService{
		groupDB:               NewInterviewGroupDB(db),
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
		OperationID:   "create-interview-groups",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/interview-groups/batch",
		Summary:       "Create several interview groups at once",
		Description:   "Chief only. All or nothing: if any group is invalid, none are created.",
		Tags:          []string{"Interview groups"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.createMany)

	huma.Register(api, huma.Operation{
		OperationID: "assign-interview-group",
		Method:      http.MethodPost,
		Path:        "/interview-groups/{id}/assignments",
		Summary:     "Assign a group as the interviewers on each application",
		Description: "Chief only. An application gets at most one group, so the request is rejected if any application already has interviewers.",
		Tags:        []string{"Interview groups"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, s.assign)
}
