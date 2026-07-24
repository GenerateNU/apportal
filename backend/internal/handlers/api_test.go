package handlers

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

func TestStoreErr(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want int
	}{
		{"not found", store.ErrNotFound, http.StatusNotFound},
		{"conflict", store.ErrConflict, http.StatusConflict},
		{"other", errExample("boom"), http.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := storeErr(tc.err)
			var se huma.StatusError
			if !errors.As(got, &se) {
				t.Fatalf("storeErr did not return a huma.StatusError: %T", got)
			}
			if se.GetStatus() != tc.want {
				t.Fatalf("status = %d, want %d", se.GetStatus(), tc.want)
			}
		})
	}
}

func TestRequireChief(t *testing.T) {
	chief := middleware.Actor{NUID: "c1", Roles: []models.UserRole{models.UserRoleChief}}
	tl := middleware.Actor{NUID: "t1", Roles: []models.UserRole{models.UserRoleLead}}

	cases := []struct {
		name     string
		ctx      context.Context
		wantErr  bool
		wantCode int
	}{
		{"no actor", context.Background(), true, http.StatusUnauthorized},
		{"tl", withActor(tl), true, http.StatusForbidden},
		{"chief", withActor(chief), false, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := requireChief(tc.ctx)
			if tc.wantErr {
				var se huma.StatusError
				if !errors.As(err, &se) || se.GetStatus() != tc.wantCode {
					t.Fatalf("got %v, want status %d", err, tc.wantCode)
				}
			} else if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// withActor returns a context carrying the given actor, mirroring what
// middleware.WithActor does once it has verified the caller's identity.
func withActor(a middleware.Actor) context.Context {
	return middleware.ContextWithActor(context.Background(), a)
}

type errExample string

func (e errExample) Error() string { return string(e) }
