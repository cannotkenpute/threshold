-- THRESHOLD Multiplayer — add a game_mode choice to CREATE LOBBY.
-- Depends on 0001 (multiplayer_lobbies.game_mode already exists, defaults 'SURVIVAL',
-- unconstrained) and 0003 (create_multiplayer_lobby RPC, which hardcoded 'SURVIVAL').
--
-- Adds p_game_mode to create_multiplayer_lobby so hosts can choose ENDLESS SURVIVAL or
-- CO-OP STORY MODE at creation time. The added parameter changes the function's argument
-- signature, so the old 6-arg overload is dropped first -- CREATE OR REPLACE alone would
-- leave both signatures coexisting and ambiguous for named-parameter RPC calls.

-- Match the CHECK-constraint pattern already used for visibility/status/region/max_players
-- (see 0001_multiplayer_schema.sql) -- game_mode was left unconstrained until now.
ALTER TABLE public.multiplayer_lobbies
  ADD CONSTRAINT multiplayer_lobbies_game_mode_check CHECK (game_mode IN ('SURVIVAL', 'STORY'));

DROP FUNCTION IF EXISTS public.create_multiplayer_lobby(text, text, text, text, integer, smallint);

CREATE OR REPLACE FUNCTION public.create_multiplayer_lobby(
  p_visibility       text     DEFAULT 'PUBLIC',
  p_region           text     DEFAULT 'AUTO',
  p_difficulty       text     DEFAULT NULL,
  p_game_version     text     DEFAULT NULL,
  p_protocol_version integer  DEFAULT NULL,
  p_max_players      smallint DEFAULT 4,
  p_game_mode        text     DEFAULT 'SURVIVAL'
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
  IF p_game_mode IS NULL OR p_game_mode NOT IN ('SURVIVAL', 'STORY') THEN
    RETURN public._mp_error('INVALID_STATE', 'game_mode must be SURVIVAL or STORY');
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
      p_region, p_game_mode, 'LEVEL_1', p_difficulty, false,
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

REVOKE ALL ON FUNCTION public.create_multiplayer_lobby(text, text, text, text, integer, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_multiplayer_lobby(text, text, text, text, integer, smallint, text) TO authenticated;
