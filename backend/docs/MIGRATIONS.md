## Migration Guide

Migrations are a log of how our database schema has changed over time, like git history but for the database. They make it easy to re-create the database and to roll changes back.

### What tools our migration workflow uses

- [Atlas](https://atlasgo.io/): generates migrations by diffing our GORM models against the existing migrations, and applies them.
- [GORM](https://gorm.io/index.html): works with Atlas to make generation automatic. `cmd/schema` loads the models, and Atlas diffs them against a temporary dev database (`docker://postgres/15/dev`, so Docker must be running).

### Generating a Migration

All migrations live in `backend/internal/migrations`. Change the models, then run from `backend/`:

```bash
make gen-migration MIGRATION_NAME=<migration-name>
```

This creates a new file in the migrations directory and updates `atlas.sum`. Commit both. Use a meaningful name like `CreateUserTable`; the target won't run without one.

If you add a model, register it in `cmd/schema/main.go`. If you add or change an enum, update the `prelude` there to match `internal/models/enums.go`.

Atlas's free tier rejects functions and triggers, so they aren't generated.

- **Functions** live in `internal/sql/run-always.sql`, written with `CREATE OR REPLACE FUNCTION`. `make migrate-dev` and `make migrate-prod` run it with `psql` after `atlas migrate apply`, every time, so editing a function needs no new migration. It needs `psql` installed. It lives outside `internal/migrations` on purpose, since Atlas would treat a file there as a versioned migration.
- **Triggers** are still written by hand in the migrations. If a new table has an `updated_at` column, add its trigger to the generated migration file, then run `atlas migrate hash --env apportal`. A trigger needs its function to exist first, so a migration can't depend on a function added only to `run-always.sql`.

### Testing a Migration

NEVER apply a migration to prod yourself. The TLs do that after your code has been reviewed. Test against your dev database:

```bash
make migrate-dev
```

This applies pending migrations, then `internal/sql/run-always.sql`, using `MIGRATION_DB_CONNECTION_STRING` from the Doppler `dev` config. It must be a direct or session connection, not Supabase's transaction pooler, because Atlas holds an advisory lock and runs DDL across one session.

To confirm the whole history applies cleanly, point `MIGRATION_DB_CONNECTION_STRING` at a fresh database (for example the local Supabase one, see the README) and run `make migrate-dev`.

### Applying to Production

```bash
make migrate-prod
```

This uses the Doppler `prd` config.

### Reverting Migrations

```bash
make revert-single-dev
make revert-single-prod
```

This reverts the last applied migration and shows a plan first so you can check it's what you want. To use other flags such as `--dry-run`, run `atlas migrate down --env apportal` yourself (with the Doppler config for the target database).

After reverting you must:

1. Delete the migration: `atlas migrate rm <migration file name> --env apportal`
2. Regenerate the hash file: `atlas migrate hash --env apportal`
