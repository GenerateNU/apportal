package user

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB) {
	userDB := NewUserDB(db)
	s := &userService{access: access.NewChecker(db), userDB: userDB}

	huma.Register(api, huma.Operation{
		OperationID: "list-users",
		Method:      http.MethodGet,
		Path:        "/users",
		Summary:     "List reviewers",
		Description: "Admins, or anyone on some cycle's staff (e.g. to invite a " +
			"fellow lead onto a preference list); creating or editing a user is " +
			"admin only. Per-cycle leads and chiefs come from list-cycle-staff.",
		Tags:   []string{"Users"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden},
	}, s.list)

	huma.Register(api, huma.Operation{
		OperationID: "get-current-user",
		Method:      http.MethodGet,
		Path:        "/users/me",
		Summary:     "Get the current user",
		Description: "Self-serve; resolves the caller's own profile from their verified session.",
		Tags:        []string{"Users"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, s.me)

	huma.Register(api, huma.Operation{
		OperationID: "get-user",
		Method:      http.MethodGet,
		Path:        "/users/{nuid}",
		Summary:     "Get a reviewer",
		Description: "Admin only.",
		Tags:        []string{"Users"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.get)

	huma.Register(api, huma.Operation{
		OperationID:   "create-user",
		Method:        http.MethodPost,
		Path:          "/users",
		Summary:       "Create a reviewer",
		Description:   "Admin only.",
		Tags:          []string{"Users"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, s.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-user",
		Method:      http.MethodPatch,
		Path:        "/users/{nuid}",
		Summary:     "Update a reviewer",
		Description: "Admin only.",
		Tags:        []string{"Users"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict},
	}, s.update)
}
