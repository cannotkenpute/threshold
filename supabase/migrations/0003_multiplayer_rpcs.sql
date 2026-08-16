-- ============================================================================
-- THRESHOLD Multiplayer — 0003_multiplayer_rpcs.sql
-- Atomic, SECURITY DEFINER lobby/match RPCs. This is the ONLY write path for
-- clients (see 0002: no write policies, write grants revoked).
--
-- Conventions:
--   * Every function returns JSONB: { "ok": true, ... } or
--     { "ok": false, "code": "<MACHINE_READABLE_CODE>", "reason": "..." }.
--   * Error codes: LOBBY_NOT_FOUND, LOBBY_FULL, LOBBY_NOT_JOINABLE,
--     ALREADY_MEMBER, INVALID_CODE, VERSION_MISMATCH, NOT_MEMBER, NOT_HOST,
--     NOT_ALL_READY, INVALID_STATE, plus AUTH_REQUIRED / MATCH_NOT_FOUND.
--   * auth.uid() is the caller identity; server time and randomness
--     (join codes, match seeds) are generated server-side only.
--   * Every mutation path first locks the lobby row with
--     SELECT ... FOR UPDATE, which serializes concurrent joins per lobby
--     (the four-slot exit gate) and protects host migration decisions.
--   * All functions SET search_path = public (SECURITY DEFINER hygiene).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Internal helpers (underscore-prefixed, not exposed to API roles)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._mp_error(p_code text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object('ok', false, 'code', p_code)
      || (CASE WHEN p_reason IS NULL
               THEN '{}'::jsonb
               ELSE jsonb_build_object('reason', p_reason) END)
$$;

-- Shared join core. PRECONDITION: caller holds FOR UPDATE lock on the lobby
-- row (passed in as p_lobby). Performs status/version/capacity/duplicate
-- checks and the member insert/reactivate under that lock.
CREATE OR REPLACE FUNCTION public._mp_join_locked_lobby(
  p_lobby            public.multiplayer_lobbies,
  p_player_id        uuid,
  p_game_version     text DEFAULT NULL,
  p_protocol_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active integer;
  v_member public.multiplayer_lobby_members;
BEGIN
  IF p_lobby.status <> 'OPEN' THEN
    RETURN public._mp_error('LOBBY_NOT_JOINABLE', 'lobby status is ' || p_lobby.status);
  END IF;

  IF p_game_version IS NOT NULL AND p_lobby.game_version <> p_game_version THEN
    RETURN public._mp_error('VERSION_MISMATCH',
      'expected game_version ' || p_lobby.game_version);
  END IF;
  IF p_protocol_version IS NOT NULL AND p_lobby.protocol_version <> p_protocol_version THEN
    RETURN public._mp_error('VERSION_MISMATCH',
      'expected protocol_version ' || p_lobby.protocol_version);
  END IF;

  -- Most recent membership row for this player, active row preferred.
  SELECT * INTO v_member
  FROM public.multiplayer_lobby_members
  WHERE lobby_id = p_lobby.id
    AND player_id = p_player_id
  ORDER BY (member_state NOT IN ('LEFT', 'KICKED')) DESC, joined_at DESC
  LIMIT 1;

  IF v_member.id IS NOT NULL AND v_member.member_state NOT IN ('LEFT', 'KICKED') THEN
    RETURN public._mp_error('ALREADY_MEMBER');
  END IF;

  -- Capacity check under the lobby row lock: this is what makes two
  -- concurrent fourth-slot joins deterministic (exactly one succeeds).
  SELECT count(*) INTO v_active
  FROM public.multiplayer_lobby_members
  WHERE lobby_id = p_lobby.id
    AND member_state NOT IN ('LEFT', 'KICKED');

  IF v_active >= p_lobby.max_players THEN
    RETURN public._mp_error('LOBBY_FULL');
  END IF;

  IF v_member.id IS NOT NULL THEN
    IF v_member.member_state = 'KICKED' THEN
      -- Kicked players may not rejoin under their old row.
      RETURN public._mp_error('LOBBY_NOT_JOINABLE', 'PLAYER_KICKED');
    END IF;
    -- Returning member: reactivate the historic LEFT row (predicate columns
    -- change here, so the partial unique index re-verifies uniqueness).
    UPDATE public.multiplayer_lobby_members
    SET member_state = 'CONNECTED',
        is_ready     = false,
        is_host      = false,
        left_at      = NULL,
        kick_reason  = NULL,
        joined_at    = now(),
        last_seen_at = now()
    WHERE id = v_member.id
    RETURNING * INTO v_member;
  ELSE
    INSERT INTO public.multiplayer_lobby_members (lobby_id, player_id, member_state, is_host, is_ready)
    VALUES (p_lobby.id, p_player_id, 'CONNECTED', false, false)
    RETURNING * INTO v_member;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lobby_id', p_lobby.id,
    'member_id', v_member.id,
    'member_state', v_member.member_state,
    'lobby', jsonb_build_object(
      'join_code', p_lobby.join_code,
      'status', p_lobby.status,
      'visibility', p_lobby.visibility,
      'host_player_id', p_lobby.host_player_id,
      'max_players', p_lobby.max_players,
      'region', p_lobby.region,
      'game_mode', p_lobby.game_mode,
      'map_id', p_lobby.map_id,
      'difficulty', p_lobby.difficulty,
      'game_version', p_lobby.game_version,
      'protocol_version', p_lobby.protocol_version
    )
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. create_multiplayer_lobby
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_multiplayer_lobby(
  p_visibility       text    DEFAULT 'PUBLIC',
  p_region           text    DEFAULT 'AUTO',
  p_difficulty       text    DEFAULT NULL,
  p_game_version     text    DEFAULT NULL,
  p_protocol_version integer DEFAULT NULL,
  p_max_players      smallint DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := auth.uid();
  v_code      text;
  v_lobby_id  uuid;
  v_attempt   integer := 0;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;
  IF p_visibility IS NULL OR p_visibility NOT IN ('PUBLIC', 'PRIVATE') THEN
    RETURN public._mp_error('INVALID_STATE', 'visibility must be PUBLIC or PRIVATE');
  END IF;
  IF p_region IS NULL OR p_region NOT IN
      ('AUTO', 'US_EAST', 'US_WEST', 'EUROPE', 'ASIA', 'OCEANIA', 'SOUTH_AMERICA') THEN
    RETURN public._mp_error('INVALID_STATE', 'invalid region');
  END IF;
  IF p_max_players IS NULL OR p_max_players < 1 OR p_max_players > 4 THEN
    RETURN public._mp_error('INVALID_STATE', 'max_players must be between 1 and 4');
  END IF;
  IF p_game_version IS NULL OR p_protocol_version IS NULL THEN
    RETURN public._mp_error('VERSION_MISMATCH', 'game_version and protocol_version are required');
  END IF;

  -- Unique 5-digit join code, generated server-side with collision retry.
  -- Uniqueness is enforced against ACTIVE lobbies only (partial unique index
  -- uq_lobbies_join_code_active), so released codes are reusable.
  WHILE v_attempt < 5 LOOP
    v_attempt := v_attempt + 1;
    v_lobby_id := NULL;
    v_code := lpad((floor(random() * 100000)::int)::text, 5, '0');

    INSERT INTO public.multiplayer_lobbies (
      join_code, host_player_id, visibility, status, max_players,
      region, game_mode, map_id, difficulty, friendly_fire,
      game_version, protocol_version
    ) VALUES (
      v_code, v_player_id, p_visibility, 'OPEN', p_max_players,
      p_region, 'SURVIVAL', 'LEVEL_1', p_difficulty, false,
      p_game_version, p_protocol_version
    )
    ON CONFLICT (join_code) WHERE status NOT IN ('CLOSED', 'ENDING')
    DO NOTHING
    RETURNING id INTO v_lobby_id;

    EXIT WHEN v_lobby_id IS NOT NULL;
  END LOOP;

  IF v_lobby_id IS NULL THEN
    RETURN public._mp_error('INVALID_STATE', 'could not allocate a unique join code');
  END IF;

  -- Lobby becomes visible only after the host membership exists.
  INSERT INTO public.multiplayer_lobby_members (lobby_id, player_id, member_state, is_host, is_ready)
  VALUES (v_lobby_id, v_player_id, 'CONNECTED', true, true);

  -- host_player_id is taken directly from auth.uid() -> caller == host.
  RETURN jsonb_build_object(
    'ok', true,
    'lobby_id', v_lobby_id,
    'join_code', v_code,
    'host_player_id', v_player_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. join_multiplayer_lobby (by lobby id)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_multiplayer_lobby(
  p_lobby_id         uuid,
  p_game_version     text    DEFAULT NULL,
  p_protocol_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := auth.uid();
  v_lobby     public.multiplayer_lobbies;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_lobby
  FROM public.multiplayer_lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public._mp_error('LOBBY_NOT_FOUND');
  END IF;

  RETURN public._mp_join_locked_lobby(v_lobby, v_player_id, p_game_version, p_protocol_version);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. join_multiplayer_lobby_by_code (5-digit code)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_multiplayer_lobby_by_code(
  p_join_code        text,
  p_game_version     text    DEFAULT NULL,
  p_protocol_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := auth.uid();
  v_lobby     public.multiplayer_lobbies;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;
  IF p_join_code IS NULL OR p_join_code !~ '^[0-9]{5}$' THEN
    RETURN public._mp_error('INVALID_CODE');
  END IF;

  -- Resolve among ACTIVE lobbies only; released codes are invalid.
  SELECT * INTO v_lobby
  FROM public.multiplayer_lobbies
  WHERE join_code = p_join_code
    AND status NOT IN ('CLOSED', 'ENDING')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public._mp_error('INVALID_CODE');
  END IF;

  RETURN public._mp_join_locked_lobby(v_lobby, v_player_id, p_game_version, p_protocol_version);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. quick_join_multiplayer_lobby
--    Picks the oldest PUBLIC OPEN lobby with free capacity in the preferred
--    region (or any region), joins it under a row lock; creates a fresh
--    lobby when nothing suitable exists. Returns "created": true|false.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.quick_join_multiplayer_lobby(
  p_region           text    DEFAULT 'AUTO',
  p_game_version     text    DEFAULT NULL,
  p_protocol_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := auth.uid();
  v_lobby     public.multiplayer_lobbies;
  v_result    jsonb;
  v_code      text;
  v_attempts  integer := 0;
  v_region    text;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;
  v_region := COALESCE(p_region, 'AUTO');
  IF p_game_version IS NULL OR p_protocol_version IS NULL THEN
    RETURN public._mp_error('VERSION_MISMATCH', 'game_version and protocol_version are required');
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    EXIT WHEN v_attempts > 5;

    -- SKIP LOCKED: concurrent quick-joins never block each other; they
    -- simply consider the next candidate lobby.
    SELECT * INTO v_lobby
    FROM public.multiplayer_lobbies l
    WHERE l.status = 'OPEN'
      AND l.visibility = 'PUBLIC'
      AND l.game_version = p_game_version
      AND l.protocol_version = p_protocol_version
      AND (v_region = 'AUTO' OR l.region IN (v_region, 'AUTO'))
      AND (SELECT count(*)
             FROM public.multiplayer_lobby_members m
            WHERE m.lobby_id = l.id
              AND m.member_state NOT IN ('LEFT', 'KICKED')) < l.max_players
    ORDER BY (l.region = v_region) DESC, l.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    EXIT WHEN NOT FOUND;

    v_result := public._mp_join_locked_lobby(v_lobby, v_player_id, p_game_version, p_protocol_version);
    v_code := v_result ->> 'code';

    IF (v_result ->> 'ok')::boolean OR v_code = 'ALREADY_MEMBER' THEN
      RETURN v_result || jsonb_build_object('created', false);
    ELSIF v_code NOT IN ('LOBBY_FULL', 'LOBBY_NOT_JOINABLE') THEN
      RETURN v_result;  -- unexpected hard error: surface it
    END IF;
    -- else: lobby filled/went unjoinable between scan and lock -> next try
  END LOOP;

  -- No joinable lobby found: create one.
  v_result := public.create_multiplayer_lobby(
    p_visibility       := 'PUBLIC',
    p_region           := v_region,
    p_difficulty       := NULL,
    p_game_version     := p_game_version,
    p_protocol_version := p_protocol_version,
    p_max_players      := 4
  );
  IF (v_result ->> 'ok')::boolean THEN
    v_result := v_result || jsonb_build_object('created', true);
  END IF;
  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. leave_multiplayer_lobby (idempotent)
--    Host migration semantics: when the host leaves and connected members
--    remain, the OLDEST (earliest joined_at, then most recently seen) active
--    member becomes host and lobby.host_player_id follows. If nobody
--    remains, the lobby is closed and its join code released.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leave_multiplayer_lobby(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := auth.uid();
  v_lobby     public.multiplayer_lobbies;
  v_member    public.multiplayer_lobby_members;
  v_successor public.multiplayer_lobby_members;
  v_was_host  boolean;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_lobby
  FROM public.multiplayer_lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public._mp_error('LOBBY_NOT_FOUND');
  END IF;

  SELECT * INTO v_member
  FROM public.multiplayer_lobby_members
  WHERE lobby_id = p_lobby_id
    AND player_id = v_player_id
    AND member_state NOT IN ('LEFT', 'KICKED')
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Idempotent: leaving a lobby you are not (anymore) in succeeds.
    RETURN jsonb_build_object('ok', true, 'member', false, 'noop', true);
  END IF;

  v_was_host := v_member.is_host OR v_lobby.host_player_id = v_player_id;

  UPDATE public.multiplayer_lobby_members
  SET member_state = 'LEFT',
      is_ready     = false,
      is_host      = false,
      left_at      = now(),
      last_seen_at = now()
  WHERE id = v_member.id;

  IF v_was_host THEN
    SELECT * INTO v_successor
    FROM public.multiplayer_lobby_members
    WHERE lobby_id = p_lobby_id
      AND member_state NOT IN ('LEFT', 'KICKED')
    ORDER BY joined_at ASC, last_seen_at DESC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.multiplayer_lobby_members SET is_host = true WHERE id = v_successor.id;
      UPDATE public.multiplayer_lobbies SET host_player_id = v_successor.player_id WHERE id = p_lobby_id;
      RETURN jsonb_build_object(
        'ok', true, 'member', true,
        'host_migrated', true,
        'new_host_player_id', v_successor.player_id
      );
    ELSE
      UPDATE public.multiplayer_lobbies
      SET status = 'CLOSED', closed_at = now(), code_release_at = now()
      WHERE id = p_lobby_id;
      RETURN jsonb_build_object('ok', true, 'member', true, 'lobby_closed', true);
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'member', true);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. set_multiplayer_ready (own row only)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_multiplayer_ready(p_lobby_id uuid, p_is_ready boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := auth.uid();
  v_lobby     public.multiplayer_lobbies;
  v_ready     boolean;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_lobby
  FROM public.multiplayer_lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public._mp_error('LOBBY_NOT_FOUND');
  END IF;

  IF v_lobby.status NOT IN ('OPEN', 'STARTING') THEN
    RETURN public._mp_error('INVALID_STATE', 'lobby status is ' || v_lobby.status);
  END IF;

  UPDATE public.multiplayer_lobby_members
  SET is_ready     = p_is_ready,
      last_seen_at = now()
  WHERE lobby_id = p_lobby_id
    AND player_id = v_player_id
    AND member_state NOT IN ('LEFT', 'KICKED')
  RETURNING is_ready INTO v_ready;

  IF NOT FOUND THEN
    RETURN public._mp_error('NOT_MEMBER');
  END IF;

  RETURN jsonb_build_object('ok', true, 'is_ready', v_ready);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. start_multiplayer_match (host only, all connected non-hosts ready)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_multiplayer_match(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := auth.uid();
  v_lobby     public.multiplayer_lobbies;
  v_unready   integer;
  v_seed      bigint;
  v_match_id  uuid;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_lobby
  FROM public.multiplayer_lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public._mp_error('LOBBY_NOT_FOUND');
  END IF;

  IF v_lobby.status <> 'OPEN' THEN
    RETURN public._mp_error('INVALID_STATE', 'lobby status is ' || v_lobby.status);
  END IF;

  IF v_lobby.host_player_id <> v_player_id THEN
    RETURN public._mp_error('NOT_HOST');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.multiplayer_lobby_members
    WHERE lobby_id = p_lobby_id
      AND player_id = v_player_id
      AND member_state NOT IN ('LEFT', 'KICKED')
  ) THEN
    RETURN public._mp_error('NOT_MEMBER');
  END IF;

  -- Every connected non-host member must be ready.
  SELECT count(*) INTO v_unready
  FROM public.multiplayer_lobby_members
  WHERE lobby_id = p_lobby_id
    AND member_state NOT IN ('LEFT', 'KICKED')
    AND player_id <> v_player_id
    AND (is_ready = false OR member_state NOT IN ('CONNECTED', 'READY'));

  IF v_unready > 0 THEN
    RETURN public._mp_error('NOT_ALL_READY');
  END IF;

  -- Brief, atomic STARTING transition (rolled back automatically on error).
  UPDATE public.multiplayer_lobbies SET status = 'STARTING' WHERE id = p_lobby_id;

  -- Server-side seed in [0, 2^53) — safe for JS Number interop.
  v_seed := floor(random() * 9007199254740992.0)::bigint;

  INSERT INTO public.multiplayer_matches (
    lobby_id, authority_player_id, authority_epoch, random_seed,
    status, game_version, protocol_version, started_at
  ) VALUES (
    p_lobby_id, v_player_id, 1, v_seed,
    'ACTIVE', v_lobby.game_version, v_lobby.protocol_version, now()
  )
  RETURNING id INTO v_match_id;

  INSERT INTO public.multiplayer_match_members (match_id, player_id, joined_at)
  SELECT v_match_id, m.player_id, now()
  FROM public.multiplayer_lobby_members m
  WHERE m.lobby_id = p_lobby_id
    AND m.member_state NOT IN ('LEFT', 'KICKED');

  UPDATE public.multiplayer_lobby_members
  SET member_state = 'PLAYING',
      is_ready     = true,
      last_seen_at = now()
  WHERE lobby_id = p_lobby_id
    AND member_state NOT IN ('LEFT', 'KICKED');

  UPDATE public.multiplayer_lobbies
  SET status = 'IN_GAME', started_at = now()
  WHERE id = p_lobby_id;

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', v_match_id,
    'random_seed', v_seed,
    'authority_player_id', v_player_id,
    'authority_epoch', 1
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8a. migrate_multiplayer_host
--     - p_new_host_id given: caller must be the current host (NOT_HOST
--       otherwise); target must be an active connected member.
--     - p_new_host_id NULL: disconnected-host recovery path. Any active
--       member may trigger it once the host is no longer present; the OLDEST
--       connected active member is promoted. A present host calling with
--       NULL simply transfers to the oldest member.
--     Authority epoch is a match-level concern -> migrate_match_authority.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.migrate_multiplayer_host(
  p_lobby_id   uuid,
  p_new_host_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id  uuid := auth.uid();
  v_lobby      public.multiplayer_lobbies;
  v_member     public.multiplayer_lobby_members;
  v_host_state text;
  v_is_host    boolean;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_lobby
  FROM public.multiplayer_lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public._mp_error('LOBBY_NOT_FOUND');
  END IF;

  IF v_lobby.status IN ('CLOSED', 'ENDING') THEN
    RETURN public._mp_error('INVALID_STATE', 'lobby status is ' || v_lobby.status);
  END IF;

  v_is_host := v_lobby.host_player_id = v_player_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.multiplayer_lobby_members
    WHERE lobby_id = p_lobby_id
      AND player_id = v_player_id
      AND member_state NOT IN ('LEFT', 'KICKED')
  ) THEN
    RETURN public._mp_error('NOT_MEMBER');
  END IF;

  IF p_new_host_id IS NULL THEN
    IF NOT v_is_host THEN
      -- Disconnected-host path: verify the host is truly not present.
      SELECT member_state INTO v_host_state
      FROM public.multiplayer_lobby_members
      WHERE lobby_id = p_lobby_id
        AND player_id = v_lobby.host_player_id
        AND member_state NOT IN ('LEFT', 'KICKED');

      IF v_host_state IN ('CONNECTED', 'READY', 'LOADING', 'PLAYING') THEN
        RETURN public._mp_error('NOT_HOST', 'current host is still connected');
      END IF;
    END IF;

    SELECT * INTO v_member
    FROM public.multiplayer_lobby_members
    WHERE lobby_id = p_lobby_id
      AND member_state NOT IN ('LEFT', 'KICKED', 'DISCONNECTED')
      AND player_id <> v_lobby.host_player_id
    ORDER BY joined_at ASC, last_seen_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN public._mp_error('INVALID_STATE', 'no connected members to promote');
    END IF;
  ELSE
    IF NOT v_is_host THEN
      RETURN public._mp_error('NOT_HOST');
    END IF;

    SELECT * INTO v_member
    FROM public.multiplayer_lobby_members
    WHERE lobby_id = p_lobby_id
      AND player_id = p_new_host_id
      AND member_state NOT IN ('LEFT', 'KICKED')
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN public._mp_error('NOT_MEMBER');
    END IF;
    IF v_member.member_state = 'DISCONNECTED' THEN
      RETURN public._mp_error('INVALID_STATE', 'target member is disconnected');
    END IF;
  END IF;

  UPDATE public.multiplayer_lobby_members
  SET is_host = (player_id = v_member.player_id)
  WHERE lobby_id = p_lobby_id
    AND member_state NOT IN ('LEFT', 'KICKED');

  UPDATE public.multiplayer_lobbies
  SET host_player_id = v_member.player_id
  WHERE id = p_lobby_id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_host_player_id', v_member.player_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8b. migrate_match_authority
--     Hands simulation authority of an ACTIVE/PAUSED_AUTHORITY match to the
--     oldest connected match member and bumps authority_epoch (clients drop
--     packets from old epochs). If nobody is connected, the match is parked
--     in PAUSED_AUTHORITY instead.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.migrate_match_authority(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id        uuid := auth.uid();
  v_match            public.multiplayer_matches;
  v_new_authority    uuid;
  v_epoch            integer;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_match
  FROM public.multiplayer_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public._mp_error('MATCH_NOT_FOUND');
  END IF;

  IF v_match.status NOT IN ('ACTIVE', 'PAUSED_AUTHORITY') THEN
    RETURN public._mp_error('INVALID_STATE', 'match status is ' || v_match.status);
  END IF;

  IF NOT public.is_match_member(p_match_id) THEN
    RETURN public._mp_error('NOT_MEMBER');
  END IF;

  SELECT mm.player_id INTO v_new_authority
  FROM public.multiplayer_match_members mm
  JOIN public.multiplayer_lobby_members lm
    ON lm.lobby_id = v_match.lobby_id
   AND lm.player_id = mm.player_id
   AND lm.member_state NOT IN ('LEFT', 'KICKED')
  WHERE mm.match_id = p_match_id
    AND (mm.disconnected_at IS NULL
         OR (mm.reconnected_at IS NOT NULL AND mm.reconnected_at > mm.disconnected_at))
    AND mm.player_id <> v_match.authority_player_id
  ORDER BY mm.joined_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.multiplayer_matches
    SET status = 'PAUSED_AUTHORITY'
    WHERE id = p_match_id;
    RETURN public._mp_error('INVALID_STATE', 'no connected members to hand authority to');
  END IF;

  UPDATE public.multiplayer_matches
  SET authority_player_id = v_new_authority,
      authority_epoch = authority_epoch + 1
  WHERE id = p_match_id
  RETURNING authority_epoch INTO v_epoch;

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', p_match_id,
    'authority_player_id', v_new_authority,
    'authority_epoch', v_epoch
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. close_stale_multiplayer_lobbies  (cron / maintenance, no auth)
--    Closes a lobby when:
--      a) it is OPEN and untouched for 15 minutes, OR
--      b) it has active members but ALL of their last_seen_at are older than
--         2 minutes (covers CREATING/OPEN/STARTING/IN_GAME heartbeats).
--    Lobbies with zero active members are only closed by rule (a), so a
--    freshly seeded empty lobby is not insta-closed.
--    Closing releases the join code (code_release_at) and aborts any active
--    match belonging to the lobby.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_stale_multiplayer_lobbies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids  uuid[];
  v_rows integer;
BEGIN
  SELECT array_agg(q.id) INTO v_ids
  FROM (
    SELECT l.id
    FROM public.multiplayer_lobbies l
    WHERE l.status IN ('CREATING', 'OPEN', 'STARTING', 'IN_GAME')
      AND (
        (l.status = 'OPEN' AND l.updated_at < now() - interval '15 minutes')
        OR (
          EXISTS (SELECT 1 FROM public.multiplayer_lobby_members m
                  WHERE m.lobby_id = l.id
                    AND m.member_state NOT IN ('LEFT', 'KICKED'))
          AND NOT EXISTS (SELECT 1 FROM public.multiplayer_lobby_members m
                          WHERE m.lobby_id = l.id
                            AND m.member_state NOT IN ('LEFT', 'KICKED')
                            AND m.last_seen_at >= now() - interval '2 minutes')
        )
      )
    FOR UPDATE
  ) q;

  IF v_ids IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.multiplayer_lobbies
  SET status = 'CLOSED',
      closed_at = now(),
      code_release_at = now()
  WHERE id = ANY (v_ids);
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  UPDATE public.multiplayer_matches
  SET status = 'ABORTED',
      ended_at = now()
  WHERE lobby_id = ANY (v_ids)
    AND status IN ('STARTING', 'ACTIVE', 'PAUSED_AUTHORITY');

  RETURN v_rows;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. submit_multiplayer_match_result (authority only, ACTIVE match)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_multiplayer_match_result(
  p_match_id uuid,
  p_result   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := auth.uid();
  v_match     public.multiplayer_matches;
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;
  IF p_result IS NOT NULL AND jsonb_typeof(p_result) <> 'object' THEN
    RETURN public._mp_error('INVALID_STATE', 'p_result must be a JSON object');
  END IF;

  SELECT * INTO v_match
  FROM public.multiplayer_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public._mp_error('MATCH_NOT_FOUND');
  END IF;

  IF v_match.status <> 'ACTIVE' THEN
    RETURN public._mp_error('INVALID_STATE', 'match status is ' || v_match.status);
  END IF;

  IF v_match.authority_player_id <> v_player_id THEN
    RETURN public._mp_error('NOT_HOST');
  END IF;

  UPDATE public.multiplayer_matches
  SET status = 'ENDED',
      ended_at = now(),
      result = p_result
  WHERE id = p_match_id;

  UPDATE public.multiplayer_lobbies
  SET status = 'CLOSED',
      closed_at = now(),
      code_release_at = now()
  WHERE id = v_match.lobby_id;

  RETURN jsonb_build_object('ok', true, 'match_id', p_match_id, 'status', 'ENDED');
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. record_member_heartbeat (own row only)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_member_heartbeat(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := auth.uid();
BEGIN
  IF v_player_id IS NULL THEN
    RETURN public._mp_error('AUTH_REQUIRED');
  END IF;

  UPDATE public.multiplayer_lobby_members
  SET last_seen_at = now()
  WHERE lobby_id = p_lobby_id
    AND player_id = v_player_id
    AND member_state NOT IN ('LEFT', 'KICKED');

  IF NOT FOUND THEN
    RETURN public._mp_error('NOT_MEMBER');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================================
-- Execution privileges
--   * Internal helpers: no API role may call them.
--   * Client RPCs: authenticated only (anon calling them would just get
--     AUTH_REQUIRED, but there is no reason to expose them).
--   * Maintenance functions: cron/postgres only.
-- ============================================================================

REVOKE ALL ON FUNCTION public._mp_error(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._mp_join_locked_lobby(public.multiplayer_lobbies, uuid, text, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_multiplayer_lobby(text, text, text, text, integer, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_multiplayer_lobby(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_multiplayer_lobby_by_code(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quick_join_multiplayer_lobby(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_multiplayer_lobby(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_multiplayer_ready(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_multiplayer_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_multiplayer_host(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_match_authority(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_multiplayer_match_result(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_member_heartbeat(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_multiplayer_lobby(text, text, text, text, integer, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_multiplayer_lobby(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_multiplayer_lobby_by_code(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quick_join_multiplayer_lobby(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_multiplayer_lobby(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_multiplayer_ready(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_multiplayer_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_multiplayer_host(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_match_authority(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_multiplayer_match_result(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_member_heartbeat(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.close_stale_multiplayer_lobbies() FROM PUBLIC;
