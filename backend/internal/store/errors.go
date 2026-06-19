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
