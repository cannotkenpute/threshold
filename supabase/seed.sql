-- ============================================================================
-- THRESHOLD Multiplayer — seed.sql  (DEVELOPMENT ONLY — DO NOT RUN IN PROD)
--
-- Creates deterministic test fixtures for local testing of the multiplayer
-- lobby flows. Non-destructive: every insert uses fixed UUIDs and
-- ON CONFLICT DO NOTHING, so re-running is safe and never overwrites live
-- rows or touches existing data.
--
-- The player UUIDs below are placeholders — swap them for real auth user
-- ids (or create matching users in dev) when testing authenticated flows.
-- Requires migrations 0001..0005 to be applied first.
--
-- Fixtures:
--   * Lobby 10001 — PUBLIC OPEN, 3 active members (host + 2) => exactly one
--     free slot: use it for the fourth-slot join gate test.
--   * Lobby 10002 — PUBLIC OPEN, zero member rows => for join-flow testing
--     (note: the stale-lobby job closes memberless lobbies only after the
--     15-minute updated_at rule, so the fixture survives local testing).
-- ============================================================================

INSERT INTO public.multiplayer_lobbies (
  id, join_code, host_player_id, visibility, status, max_players,
  region, game_mode, map_id, difficulty, game_version, protocol_version
) VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '10001',
    '22222222-2222-4222-8222-222222222221',
    'PUBLIC', 'OPEN', 4,
    'US_EAST', 'SURVIVAL', 'LEVEL_1', 'NORMAL', '0.1.0', 1
  ),
  (
    '11111111-1111-4111-8111-111111111112',
    '10002',
    '22222222-2222-4222-8222-222222222224',
    'PUBLIC', 'OPEN', 4,
    'AUTO', 'SURVIVAL', 'LEVEL_1', 'NORMAL', '0.1.0', 1
  )
ON CONFLICT DO NOTHING;

-- Lobby 10001 members: 3 of 4 slots taken. All marked ready so
-- start_multiplayer_match() can also be exercised once the fourth joins.
INSERT INTO public.multiplayer_lobby_members (
  id, lobby_id, player_id, display_name, member_state, is_host, is_ready
) VALUES
  (
    '33333333-3333-4333-8333-333333333331',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222221',
    'TEST_HOST', 'CONNECTED', true, true
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'TEST_PLAYER_2', 'CONNECTED', false, true
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222223',
    'TEST_PLAYER_3', 'CONNECTED', false, true
  )
ON CONFLICT DO NOTHING;

-- Lobby 10002 intentionally has NO member rows (empty lobby fixture).
