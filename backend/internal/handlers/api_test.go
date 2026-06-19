package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

func TestWriteJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	writeJSON(rec, http.StatusCreated, map[string]string{"hello": "world"})

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusCreated)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content-type = %q, want application/json", ct)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["hello"] != "world" {
		t.Fatalf("body = %v, want hello=world", body)
	}
}

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
	chief := middleware.Actor{NUID: "c1", Role: models.ReviewerRoleChief}
	tl := middleware.Actor{NUID: "t1", Role: models.ReviewerRoleTL}

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
// middleware.WithActor does from request headers.
func withActor(a middleware.Actor) context.Context {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-NUID", a.NUID)
	r.Header.Set("X-Role", string(a.Role))
	captured := r.Context()
	middleware.WithActor(http.HandlerFunc(func(_ http.ResponseWriter, req *http.Request) {
		captured = req.Context()
	})).ServeHTTP(httptest.NewRecorder(), r)
	return captured
}

type errExample string

func (e errExample) Error() string { return string(e) }
