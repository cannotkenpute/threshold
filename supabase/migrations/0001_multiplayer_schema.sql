-- ============================================================================
-- THRESHOLD Multiplayer — 0001_multiplayer_schema.sql
-- Tables, constraints, indexes, updated_at triggers.
--
-- PostgreSQL 15 / Supabase flavored SQL.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.
-- ============================================================================

-- gen_random_uuid() is built-in on PG13+, pgcrypto guarantees it everywhere.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.multiplayer_lobbies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  join_code       VARCHAR(5),
  host_player_id  UUID NOT NULL,

  visibility      TEXT NOT NULL DEFAULT 'PUBLIC'
                    CHECK (visibility IN ('PUBLIC', 'PRIVATE')),

  status          TEXT NOT NULL DEFAULT 'CREATING'
                    CHECK (status IN ('CREATING', 'OPEN', 'STARTING', 'IN_GAME', 'ENDING', 'CLOSED')),

  max_players     SMALLINT NOT NULL DEFAULT 4
                    CHECK (max_players BETWEEN 1 AND 4),

  region          TEXT NOT NULL DEFAULT 'AUTO'
                    CHECK (region IN ('AUTO', 'US_EAST', 'US_WEST', 'EUROPE', 'ASIA', 'OCEANIA', 'SOUTH_AMERICA')),

  game_mode       VARCHAR NOT NULL DEFAULT 'SURVIVAL',
  map_id          VARCHAR NOT NULL DEFAULT 'LEVEL_1',
  difficulty      VARCHAR,
  friendly_fire   BOOLEAN NOT NULL DEFAULT false,

  game_version    VARCHAR NOT NULL,
  protocol_version INTEGER NOT NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  code_release_at TIMESTAMPTZ,

  -- join_code is either NULL or exactly five digits.
  -- The 5-digit code is NEVER a key: the UUID PK is the identity.
  CONSTRAINT multiplayer_lobbies_join_code_format CHECK (join_code ~ '^[0-9]{5}$')
);

CREATE TABLE IF NOT EXISTS public.multiplayer_lobby_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id     UUID NOT NULL REFERENCES public.multiplayer_lobbies(id) ON DELETE CASCADE,
  player_id    UUID NOT NULL,
  display_name VARCHAR,

  member_state TEXT NOT NULL DEFAULT 'JOINING'
                 CHECK (member_state IN ('JOINING', 'CONNECTED', 'READY', 'LOADING', 'PLAYING', 'DISCONNECTED', 'LEFT', 'KICKED')),

  is_host      BOOLEAN NOT NULL DEFAULT false,
  is_ready     BOOLEAN NOT NULL DEFAULT false,

  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at      TIMESTAMPTZ,

  kick_reason  VARCHAR
);

CREATE TABLE IF NOT EXISTS public.multiplayer_matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id            UUID NOT NULL REFERENCES public.multiplayer_lobbies(id) ON DELETE CASCADE,
  authority_player_id UUID NOT NULL,

  authority_epoch     INTEGER NOT NULL DEFAULT 1
                        CHECK (authority_epoch >= 1),

  -- Server-side generated; clients never supply seeds.
  random_seed         BIGINT NOT NULL,

  status              TEXT NOT NULL DEFAULT 'STARTING'
                        CHECK (status IN ('STARTING', 'ACTIVE', 'PAUSED_AUTHORITY', 'ENDED', 'ABORTED')),

  game_version        VARCHAR NOT NULL,
  protocol_version    INTEGER NOT NULL,

  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  result              JSONB
);

CREATE TABLE IF NOT EXISTS public.multiplayer_match_members (
  match_id                UUID NOT NULL REFERENCES public.multiplayer_matches(id) ON DELETE CASCADE,
  player_id               UUID NOT NULL,

  joined_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at         TIMESTAMPTZ,
  reconnected_at          TIMESTAMPTZ,

  last_accepted_position  JSONB,
  final_score             INTEGER,
  survival_time_ms        BIGINT,
  result                  JSONB,

  PRIMARY KEY (match_id, player_id)
);

-- ============================================================================
-- Constraints & indexes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DESIGN DECISION — unique ACTIVE membership per (lobby, player):
-- Implemented as a PARTIAL UNIQUE INDEX rather than a deferrable constraint
-- trigger. Rationale:
--   * member_state participates in the predicate, so any transition of an
--     existing row INTO an active state (e.g. LEFT -> CONNECTED rejoin, done
--     via UPDATE in join RPCs) inserts a fresh index entry, which PostgreSQL
--     DOES uniqueness-check. Only updates that keep the row outside the
--     predicate (LEFT -> KICKED) skip the check, and those cannot create
--     duplicates by definition.
--   * All client mutations flow through SECURITY DEFINER RPCs that first take
--     a FOR UPDATE lock on the lobby row, serializing joins per lobby.
--   * Note (documented trade-off): plain unique *index* checks are immediate,
--     not deferrable; the RPC-per-lobby lock makes deferred checking
--     unnecessary.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_lobby_membership
  ON public.multiplayer_lobby_members (lobby_id, player_id)
  WHERE member_state NOT IN ('LEFT', 'KICKED');

-- ----------------------------------------------------------------------------
-- DESIGN DECISION — join-code uniqueness only while the lobby is active:
-- Partial unique index; CLOSED / ENDING lobbies release their code so the
-- 5-digit space (100,000 codes) stays reusable. At any moment at most ~100k
-- lobbies can hold codes; the create RPC retries on collision and the stale
-- lobby cleanup releases codes quickly.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_lobbies_join_code_active
  ON public.multiplayer_lobbies (join_code)
  WHERE status NOT IN ('CLOSED', 'ENDING');

-- Lobby browser / quick-join scan: public OPEN lobbies only.
CREATE INDEX IF NOT EXISTS idx_lobbies_public_open
  ON public.multiplayer_lobbies (status, region, created_at)
  WHERE visibility = 'PUBLIC' AND status = 'OPEN';

-- Members by lobby (roster loads, capacity counts).
CREATE INDEX IF NOT EXISTS idx_lobby_members_by_lobby
  ON public.multiplayer_lobby_members (lobby_id);

-- Members by player ("what am I in?", cross-lobby lookups).
CREATE INDEX IF NOT EXISTS idx_lobby_members_by_player
  ON public.multiplayer_lobby_members (player_id);

-- Matches by lobby (current match of a lobby) and active matches for cleanup.
CREATE INDEX IF NOT EXISTS idx_matches_by_lobby
  ON public.multiplayer_matches (lobby_id);

CREATE INDEX IF NOT EXISTS idx_matches_active
  ON public.multiplayer_matches (status, updated_at)
  WHERE status IN ('ACTIVE', 'PAUSED_AUTHORITY');

-- Match members by player (player history / reconnect lookups).
CREATE INDEX IF NOT EXISTS idx_match_members_by_player
  ON public.multiplayer_match_members (player_id);

-- ============================================================================
-- updated_at maintenance (moddatetime pattern)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_multiplayer_lobbies_updated_at ON public.multiplayer_lobbies;
CREATE TRIGGER trg_multiplayer_lobbies_updated_at
  BEFORE UPDATE ON public.multiplayer_lobbies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_multiplayer_matches_updated_at ON public.multiplayer_matches;
CREATE TRIGGER trg_multiplayer_matches_updated_at
  BEFORE UPDATE ON public.multiplayer_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
