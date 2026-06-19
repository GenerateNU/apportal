// Package store is the repository layer: it owns the *sql.DB and exposes
// typed methods that run raw SQL (via the pgx stdlib driver) and return models.
package store

import (
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a lookup matches no rows. Handlers map it to 404.
var ErrNotFound = errors.New("not found")

// ErrConflict is returned when a write violates a uniqueness constraint.
// Handlers map it to 409.
var ErrConflict = errors.New("conflict")

// Store holds the connection pool shared by every domain method.
type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}
