-- THRESHOLD Multiplayer — Phase 11 cleanup jobs
-- Depends on 0001_multiplayer_schema.sql (tables) + 0003 RPCs (not included here).
-- Safe to run repeatedly (idempotent function definition).

-- Close abandoned/stale lobbies and release their join codes for reuse.
-- §33/§48: empty OPEN lobbies close after a grace period; codes recycle after cooldown.
create or replace function public.close_stale_multiplayer_lobbies(
  p_empty_grace_seconds integer default 60,
  p_open_max_age_seconds integer default 3600,
  p_code_cooldown_seconds integer default 900
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed integer := 0;
begin
  -- 1. Close lobbies with no connected members past the empty grace window.
  with empty_lobbies as (
    select l.id
    from multiplayer_lobbies l
    where l.status in ('CREATING', 'OPEN', 'STARTING')
      and not exists (
        select 1 from multiplayer_lobby_members m
        where m.lobby_id = l.id
          and m.member_state in ('JOINING','CONNECTED','READY','LOADING','PLAYING')
          and m.last_seen_at > now() - make_interval(secs => p_empty_grace_seconds)
      )
  )
  update multiplayer_lobbies l
     set status = 'CLOSED',
         closed_at = now(),
         updated_at = now(),
         code_release_at = now() + make_interval(secs => p_code_cooldown_seconds)
    from empty_lobbies e
   where l.id = e.id;
  get diagnostics v_closed = row_count;

  -- 2. Force-close very old OPEN lobbies regardless of membership churn.
  update multiplayer_lobbies l
     set status = 'CLOSED',
         closed_at = now(),
         updated_at = now(),
         code_release_at = now() + make_interval(secs => p_code_cooldown_seconds)
   where l.status in ('CREATING','OPEN')
     and l.created_at < now() - make_interval(secs => p_open_max_age_seconds);

  -- 3. Free join codes whose cooldown has elapsed so they can be recycled.
  update multiplayer_lobbies l
     set join_code = null,
         updated_at = now()
   where l.status = 'CLOSED'
     and l.join_code is not null
     and l.code_release_at is not null
     and l.code_release_at <= now();

  return v_closed;
end;
$$;

-- Schedule via pg_cron if available (no-op if the extension is absent).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'threshold-close-stale-lobbies',
      '* * * * *',
      $cron$ select public.close_stale_multiplayer_lobbies(); $cron$
    );
  end if;
end;
$$;
