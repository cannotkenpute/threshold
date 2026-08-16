-- ============================================================================
-- THRESHOLD Multiplayer — 0004_realtime_authorization.sql
-- Private Realtime channel authorization for lobby:<uuid> / match:<uuid>.
--
-- MODEL (Supabase Realtime):
--   * postgres_changes (clients subscribing to table changes) are authorized
--     by table RLS from 0002 — the four tables are in the supabase_realtime
--     publication, and is_lobby_member()/is_match_member() gate every row.
--   * Broadcast/presence on PRIVATE channels ("lobby:<uuid>", "match:<uuid>")
--     use WALRUS: Realtime inserts into realtime.messages on the caller's
--     behalf, so RLS INSERT policies on realtime.messages ARE the
--     authorization hook. Policies below allow inserts only when the caller
--     is an ACTIVE member of the lobby/match encoded in the topic.
--   * is_lobby_member(uuid) / is_match_member(uuid) are defined in 0002 and
--     re-asserted here; they are STABLE + SECURITY DEFINER so they can also
--     be reused by a custom authorization hook or edge function if the
--     project later moves off WALRUS.
-- ============================================================================

-- Re-assert helpers (idempotent; full definitions live in 0002).
CREATE OR REPLACE FUNCTION public.is_lobby_member(p_lobby_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.multiplayer_lobby_members m
    WHERE m.lobby_id = p_lobby_id
      AND m.player_id = auth.uid()
      AND m.member_state NOT IN ('LEFT', 'KICKED')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_match_member(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.multiplayer_matches t
    WHERE t.id = p_match_id
      AND EXISTS (
        SELECT 1
        FROM public.multiplayer_lobby_members m
        WHERE m.lobby_id = t.lobby_id
          AND m.player_id = auth.uid()
          AND m.member_state NOT IN ('LEFT', 'KICKED')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_lobby_member(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_match_member(uuid) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Topic-parsing wrappers. CASE guarantees the regex is validated BEFORE the
-- uuid cast, so a malformed topic can never raise — it simply authorizes
-- false. Channel topics: 'lobby:<lobby-uuid>' and 'match:<match-uuid>'.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_lobby_channel_member(p_topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_topic ~ '^lobby:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.is_lobby_member(substring(p_topic from 7)::uuid)
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_match_channel_member(p_topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_topic ~ '^match:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.is_match_member(substring(p_topic from 7)::uuid)
    ELSE false
  END;
$$;

GRANT EXECUTE ON FUNCTION public.is_lobby_channel_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_match_channel_member(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- WALRUS grants + policies on realtime.messages.
-- INSERT policies are permissive and OR-combined with any policies that
-- already exist on realtime.messages, so other channels keep working.
-- ----------------------------------------------------------------------------

GRANT INSERT ON realtime.messages TO authenticated;

DROP POLICY IF EXISTS threshold_realtime_lobby_channel ON realtime.messages;
CREATE POLICY threshold_realtime_lobby_channel
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_lobby_channel_member(realtime.messages.topic));

DROP POLICY IF EXISTS threshold_realtime_match_channel ON realtime.messages;
CREATE POLICY threshold_realtime_match_channel
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_match_channel_member(realtime.messages.topic));

-- ----------------------------------------------------------------------------
-- Make sure the game tables stay in the realtime publication (idempotent;
-- also done in 0002 — repeated here so this file is self-sufficient).
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'multiplayer_lobbies',
    'multiplayer_lobby_members',
    'multiplayer_matches',
    'multiplayer_match_members'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN
        RAISE NOTICE 'publication supabase_realtime not found; % not added', t;
    END;
  END LOOP;
END $$;
