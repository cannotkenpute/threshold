-- ============================================================================
-- THRESHOLD Multiplayer — 0005_cleanup_jobs.sql
-- pg_cron maintenance schedules (Supabase Dashboard > Database > Cron).
--
-- Jobs (all idempotent — re-running this file reschedules, never duplicates):
--   * threshold-close-stale-lobbies    every minute   close_stale_multiplayer_lobbies()
--   * threshold-abort-stale-matches    every 5 min    abort PAUSED_AUTHORITY > 30 min
--   * threshold-delete-closed-lobbies  hourly         delete CLOSED lobbies > 24 h
-- ============================================================================

-- Safe on Supabase; degrades to a notice on environments without pg_cron.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable, cleanup jobs not scheduled: %', SQLERRM;
END $$;

-- Only proceed to schedule when the cron schema actually exists (extension
-- install failed => cron.schedule() is undefined and would abort the script).

-- ----------------------------------------------------------------------------
-- Harder lobby cleanup: delete CLOSED lobbies older than 24 hours.
-- ON DELETE CASCADE removes their member / match / match_member rows.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_old_closed_lobbies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  DELETE FROM public.multiplayer_lobbies
  WHERE status = 'CLOSED'
    AND closed_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

-- ----------------------------------------------------------------------------
-- Match cleanup: abort matches stuck in PAUSED_AUTHORITY for > 30 minutes
-- (nobody reclaimed authority; matches.updated_at is maintained by the
-- trigger from 0001 and records the moment of the last status change).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.abort_stale_authority_matches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.multiplayer_matches
  SET status = 'ABORTED',
      ended_at = now()
  WHERE status = 'PAUSED_AUTHORITY'
    AND updated_at < now() - interval '30 minutes';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_old_closed_lobbies()    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abort_stale_authority_matches() FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- Schedules (unschedule-by-name first so re-runs never duplicate jobs)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  job text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'cron schema missing; skipping job scheduling';
    RETURN;
  END IF;

  job := 'threshold-close-stale-lobbies';
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job) THEN
    PERFORM cron.unschedule(job);
  END IF;
  PERFORM cron.schedule(job, '* * * * *', 'SELECT public.close_stale_multiplayer_lobbies()');

  job := 'threshold-abort-stale-matches';
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job) THEN
    PERFORM cron.unschedule(job);
  END IF;
  PERFORM cron.schedule(job, '*/5 * * * *', 'SELECT public.abort_stale_authority_matches()');

  job := 'threshold-delete-closed-lobbies';
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job) THEN
    PERFORM cron.unschedule(job);
  END IF;
  PERFORM cron.schedule(job, '0 * * * *', 'SELECT public.delete_old_closed_lobbies()');
END $$;
