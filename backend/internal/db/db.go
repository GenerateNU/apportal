package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Open creates a native pgx connection pool. The native pgx interface (rather
// than database/sql) is used so the store can rely on pgx helpers like
// pgx.CollectRows.
func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	config.MaxConns = 5
	config.MaxConnLifetime = 30 * time.Minute

	// Supabase's connection poolers (PgBouncer/Supavisor in transaction mode,
	// e.g. port 6543) do not support the server-side named prepared-statement
	// cache that pgx uses by default — reused pooled connections collide with
	// "prepared statement already exists" (42P05). QueryExecModeExec uses an
	// unnamed prepared statement per query, which is connection-local and
	// pooler-safe while keeping proper server-side parameter typing.
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec

	return pgxpool.NewWithConfig(ctx, config)
}
