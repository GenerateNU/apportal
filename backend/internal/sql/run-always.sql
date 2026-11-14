-- Re-applied after every `make migrate-*` (Atlas's free tier can't manage
-- functions). Keep every statement idempotent, e.g. CREATE OR REPLACE.
-- Not in internal/migrations: Atlas would treat it as a versioned migration.

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_reviewer() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.email = (auth.jwt() ->> 'email')
      AND u.roles && ARRAY['lead', 'chief', 'admin']::public.user_role[]
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_reviewer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_reviewer() TO authenticated;

DROP POLICY IF EXISTS "reviewers receive interview writeup" ON realtime.messages;
CREATE POLICY "reviewers receive interview writeup" ON realtime.messages
  FOR SELECT TO authenticated
  USING (realtime.topic() LIKE 'interview-writeup:%' AND public.is_reviewer());

DROP POLICY IF EXISTS "reviewers send interview writeup" ON realtime.messages;
CREATE POLICY "reviewers send interview writeup" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (realtime.topic() LIKE 'interview-writeup:%' AND public.is_reviewer());
