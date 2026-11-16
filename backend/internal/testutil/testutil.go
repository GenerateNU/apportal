// Package testutil holds helpers shared by the handler packages' tests.
package testutil

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"

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

func TestDB(t *testing.T) *gorm.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	db, err := appdb.Open(ctx, url)
	if err == nil {
		err = db.WithContext(ctx).Exec("SELECT 1 FROM cycle_steps LIMIT 1").Error
	}
	if err != nil {
		t.Skipf("test database unavailable: %v", err)
	}
	tx := db.Begin()
	t.Cleanup(func() {
		tx.Rollback()
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return tx
}
