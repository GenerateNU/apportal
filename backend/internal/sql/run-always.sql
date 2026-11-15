-- Re-applied after every `make migrate-*` (Atlas's free tier can't manage
-- functions). Keep every statement idempotent, e.g. CREATE OR REPLACE.
-- Not in internal/migrations: Atlas would treat it as a versioned migration.

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_draft_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  row_data record := COALESCE(NEW, OLD);
  target_draft uuid;
  target_cycle uuid;
BEGIN
  IF TG_TABLE_NAME = 'drafts' THEN
    target_draft := row_data.id;
    target_cycle := row_data.cycle_id;
  ELSE
    target_draft := row_data.draft_id;
    SELECT cycle_id INTO target_cycle FROM public.drafts WHERE id = target_draft;
  END IF;
  IF target_cycle IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('draft_id', target_draft),
        'changed',
        'draft:' || target_cycle,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_drafts_notify AFTER INSERT OR UPDATE OR DELETE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.notify_draft_change();
CREATE OR REPLACE TRIGGER trg_draft_teams_notify AFTER INSERT OR UPDATE OR DELETE ON public.draft_teams
  FOR EACH ROW EXECUTE FUNCTION public.notify_draft_change();
CREATE OR REPLACE TRIGGER trg_draft_picks_notify AFTER INSERT OR UPDATE OR DELETE ON public.draft_picks
  FOR EACH ROW EXECUTE FUNCTION public.notify_draft_change();
