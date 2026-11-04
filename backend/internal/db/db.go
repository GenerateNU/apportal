package db

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

// Open creates a GORM handle over a pgx pool, so the pool settings below still
// govern every query GORM issues.
func Open(ctx context.Context, databaseURL string) (*gorm.DB, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	// 5 was too tight: a single page can fan out into a dozen-plus queries
	// (e.g. chief-review's detail page prefetches ~7 endpoints in parallel,
	// several of which issue 2-3 sequential queries of their own), so they
	// were queueing for a free connection instead of actually running
	// concurrently.
	config.MaxConns = 20
	config.MaxConnLifetime = 30 * time.Minute

	// Supabase's connection poolers (PgBouncer/Supavisor in transaction mode,
	// e.g. port 6543) do not support the server-side named prepared-statement
	// cache that pgx uses by default — reused pooled connections collide with
	// "prepared statement already exists" (42P05). QueryExecModeExec uses an
	// unnamed prepared statement per query, which is connection-local and
	// pooler-safe while keeping proper server-side parameter typing.
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}
	return gorm.Open(postgres.New(postgres.Config{Conn: stdlib.OpenDBFromPool(pool)}), gormConfig())
}

// OpenDryRun builds SQL without a connection, for generating the OpenAPI spec
// and for tests that assert on the generated SQL.
func OpenDryRun() (*gorm.DB, error) {
	config := gormConfig()
	config.DryRun = true
	config.DisableAutomaticPing = true
	return gorm.Open(postgres.New(postgres.Config{DSN: "host=localhost"}), config)
}

// NamingStrategy is shared with the schema loader so generated columns match
// the ones queries use.
var NamingStrategy = schema.NamingStrategy{NameReplacer: strings.NewReplacer("NUID", "Nuid")}

func gormConfig() *gorm.Config {
	return &gorm.Config{
		// Without this, NUID fields map to n_uid columns.
		NamingStrategy: NamingStrategy,
		// Callers map gorm.ErrRecordNotFound themselves; it isn't worth a log line.
		Logger: logger.Default.LogMode(logger.Silent),
	}
}
