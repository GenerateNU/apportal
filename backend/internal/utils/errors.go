package utils

import (
	"errors"
	"log/slog"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

// ErrNotFound is returned when a lookup matches no rows. Handlers map it to 404.
var ErrNotFound = errors.New("not found")

// ErrConflict is returned when a write violates a uniqueness constraint.
// Handlers map it to 409.
var ErrConflict = errors.New("conflict")

// UniqueViolation reports whether err is a Postgres unique-constraint violation
// (SQLSTATE 23505). The pgx stdlib driver surfaces these as *pgconn.PgError.
func UniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

// InvalidInput reports whether err is a Postgres data-integrity violation caused
// by bad client input rather than a server fault: a foreign key referencing a
// row that does not exist (23503), a missing required column (23502), or a
// failed CHECK constraint (23514). Handlers map these to 422 instead of 500.
func InvalidInput(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23503", "23502", "23514":
			return true
		}
	}
	return false
}

// StoreErr maps DB sentinel errors to the matching Huma HTTP error so the
// operation returns the right status code (and it appears in the OpenAPI spec).
func StoreErr(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return huma.Error404NotFound("not found")
	case errors.Is(err, ErrConflict):
		return huma.Error409Conflict("already exists")
	case InvalidInput(err):
		return huma.Error422UnprocessableEntity("request references data that does not exist or violates a constraint")
	default:
		slog.Error("unexpected database error", "error", err)
		return huma.Error500InternalServerError("internal server error")
	}
}

// DBErr maps gorm's not-found and Postgres unique violations onto ErrNotFound
// and ErrConflict; anything else passes through.
func DBErr(err error) error {
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		return ErrNotFound
	case UniqueViolation(err):
		return ErrConflict
	}
	return err
}
