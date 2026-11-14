-- Re-applied after every `make migrate-*` (Atlas's free tier can't manage
-- functions). Keep every statement idempotent, e.g. CREATE OR REPLACE.
-- Not in internal/migrations: Atlas would treat it as a versioned migration.

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
