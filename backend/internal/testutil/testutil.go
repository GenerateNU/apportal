// Package testutil holds helpers shared by the handler packages' tests.
package testutil

import (
	"context"
	"errors"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
)

func WithActor(a middleware.Actor) context.Context {
	return middleware.ContextWithActor(context.Background(), a)
}

func WantStatus(t *testing.T, err error, code int) {
	t.Helper()
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != code {
		t.Fatalf("got %v, want %d", err, code)
	}
}
