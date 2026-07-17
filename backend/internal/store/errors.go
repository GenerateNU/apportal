package store

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// uniqueViolation reports whether err is a Postgres unique-constraint violation
// (SQLSTATE 23505). The pgx stdlib driver surfaces these as *pgconn.PgError.
func uniqueViolation(err error) bool {
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
