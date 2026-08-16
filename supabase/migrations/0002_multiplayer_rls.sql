-- ============================================================================
-- THRESHOLD Multiplayer — 0002_multiplayer_rls.sql
-- Row Level Security, safe public lobby view, grants, realtime publication.
--
-- MUTATION MODEL: clients never INSERT/UPDATE/DELETE these tables directly.
-- All writes go through SECURITY DEFINER RPCs (0003). This file:
--   * enables RLS on all four tables,
--   * provides read-only SELECT policies,
--   * revokes write privileges from anon/authenticated as defense in depth.
-- ============================================================================

-- ============================================================================
-- Membership helper functions
--
-- Used inside RLS policies to avoid "infinite recursion detected in policy"
-- (policies on multiplayer_lobby_members must not query that same table).
-- SECURITY DEFINER + owner (postgres) bypasses RLS for the check itself.
-- These helpers are also reused by Realtime channel authorization (0004).
-- ============================================================================

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

-- Policies invoke these on behalf of the calling role; EXECUTE is required.
GRANT EXECUTE ON FUNCTION public.is_lobby_member(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_match_member(uuid) TO anon, authenticated;

-- ============================================================================
-- Enable RLS
-- ============================================================================

ALTER TABLE public.multiplayer_lobbies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_lobby_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_matches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_match_members  ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- multiplayer_lobbies policies (SELECT only — no write policies by design)
-- ============================================================================

-- Anyone (anon + authenticated) may see PUBLIC OPEN lobbies (browser).
CREATE POLICY lobbies_select_public_open
  ON public.multiplayer_lobbies
  FOR SELECT
  TO anon, authenticated
  USING (visibility = 'PUBLIC' AND status = 'OPEN');

-- Active members may see their own lobby row, PRIVATE lobbies included.
CREATE POLICY lobbies_select_members
  ON public.multiplayer_lobbies
  FOR SELECT
  TO authenticated
  USING (public.is_lobby_member(public.multiplayer_lobbies.id));

-- ============================================================================
-- multiplayer_lobby_members policies (SELECT only)
-- ============================================================================

-- Active members can see every member row of their lobby (roster),
-- including their own. Left/kicked players lose access.
CREATE POLICY lobby_members_select_lobby
  ON public.multiplayer_lobby_members
  FOR SELECT
  TO authenticated
  USING (public.is_lobby_member(public.multiplayer_lobby_members.lobby_id));

-- ============================================================================
-- multiplayer_matches policies (SELECT only)
-- ============================================================================

CREATE POLICY matches_select_members
  ON public.multiplayer_matches
  FOR SELECT
  TO authenticated
  USING (public.is_lobby_member(public.multiplayer_matches.lobby_id));

-- ============================================================================
-- multiplayer_match_members policies (SELECT only)
-- ============================================================================

CREATE POLICY match_members_select_members
  ON public.multiplayer_match_members
  FOR SELECT
  TO authenticated
  USING (public.is_match_member(public.multiplayer_match_members.match_id));

-- ----------------------------------------------------------------------------
-- NO INSERT / UPDATE / DELETE policies are defined on any of the four tables.
-- Client-side updates (even a member touching their own is_ready /
-- last_seen_at / member_state) are intentionally prohibited — those mutations
-- happen exclusively inside the SECURITY DEFINER RPCs in 0003 after
-- validation. Direct table writes are additionally blocked by the REVOKEs
-- below, so both RLS *and* grant layers enforce "RPCs only".
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Safe public lobby view
--
-- Exposes only browser-safe columns (never host_player_id, never internal
-- member rows). The PUBLIC+OPEN filter is baked into the view definition, so
-- even though the view executes with owner privileges (bypassing RLS) it can
-- never leak private lobbies. anon is revoked from the base table and reads
-- the browser through this view.
-- ============================================================================

CREATE OR REPLACE VIEW public.public_lobbies_view AS
SELECT
  l.id,
  l.visibility,
  l.status,
  l.max_players,
  l.region,
  l.game_mode,
  l.map_id,
  l.difficulty,
  l.game_version,
  l.protocol_version,
  l.created_at,
  (SELECT count(*)
     FROM public.multiplayer_lobby_members m
    WHERE m.lobby_id = l.id
      AND m.member_state NOT IN ('LEFT', 'KICKED')) AS player_count,
  (SELECT m.display_name
     FROM public.multiplayer_lobby_members m
    WHERE m.lobby_id = l.id
      AND m.member_state NOT IN ('LEFT', 'KICKED')
    ORDER BY m.is_host DESC, m.joined_at ASC
    LIMIT 1) AS host_display_name
FROM public.multiplayer_lobbies l
WHERE l.visibility = 'PUBLIC'
  AND l.status = 'OPEN';

GRANT SELECT ON public.public_lobbies_view TO anon, authenticated;

-- ============================================================================
-- Privileges: read-only for clients, mutations via RPCs only
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.multiplayer_lobbies       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.multiplayer_lobby_members FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.multiplayer_matches       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.multiplayer_match_members FROM anon, authenticated;

-- anon only reads the safe view; authenticated keeps base-table SELECT
-- (required for Realtime postgres_changes delivery, still filtered by RLS).
REVOKE SELECT ON public.multiplayer_lobbies, public.multiplayer_lobby_members,
                public.multiplayer_matches, public.multiplayer_match_members
  FROM anon;

-- ============================================================================
-- Realtime publication
-- ============================================================================

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
      WHEN duplicate_object THEN NULL;  -- already in publication
      WHEN undefined_object THEN
        RAISE NOTICE 'publication supabase_realtime not found; % not added', t;
    END;
  END LOOP;
END $$;
