# THRESHOLD Multiplayer — Supabase Schema

Phase 2 (Supabase schema, Auth, RLS, RPCs) for the THRESHOLD multiplayer plan
(`../THRESHOLD_MULTIPLAYER_ARCHITECTURE.md`).

## Files

| File | Purpose |
| --- | --- |
| `migrations/0001_multiplayer_schema.sql` | Tables, checks, indexes, `updated_at` triggers |
| `migrations/0002_multiplayer_rls.sql` | RLS policies, `public_lobbies_view`, grants, realtime publication |
| `migrations/0003_multiplayer_rpcs.sql` | All atomic `SECURITY DEFINER` RPCs (the only client write path) |
| `migrations/0004_realtime_authorization.sql` | `lobby:` / `match:` private channel auth (WALRUS) |
| `migrations/0005_cleanup_jobs.sql` | `pg_cron` schedules (stale lobbies, aborts, 24h purge) |
| `seed.sql` | Dev-only fixtures (2 lobbies, codes `10001` / `10002`) |

## How to apply

Supabase Dashboard → SQL Editor → run in order:

```
0001_multiplayer_schema.sql
0002_multiplayer_rls.sql
0003_multiplayer_rpcs.sql
0004_realtime_authorization.sql
0005_cleanup_jobs.sql
seed.sql   (dev only)
```

Every file is idempotent (IF NOT EXISTS / OR REPLACE / ON CONFLICT /
unschedule-before-schedule), so re-running is safe. Verify afterwards:
`select * from pg_policies where tablename like 'multiplayer%';` and
`select jobname, schedule from cron.job;`.

## Client contract

- Clients call only the RPCs (PostgREST `rpc/...` with the user JWT). They
  never INSERT/UPDATE/DELETE tables — RLS has no write policies and write
  grants are revoked.
- Every RPC returns JSONB: `{"ok": true, ...}` or
  `{"ok": false, "code": "LOBBY_FULL", "reason": "..."}`. Error codes:
  `LOBBY_NOT_FOUND`, `LOBBY_FULL`, `LOBBY_NOT_JOINABLE`, `ALREADY_MEMBER`,
  `INVALID_CODE`, `VERSION_MISMATCH`, `NOT_MEMBER`, `NOT_HOST`,
  `NOT_ALL_READY`, `INVALID_STATE`, `AUTH_REQUIRED`, `MATCH_NOT_FOUND`.
- Lobby browser (anon-safe): query `public_lobbies_view` — public OPEN
  lobbies only, no `host_player_id`, no join code.
- Heartbeat: `record_member_heartbeat(lobby_id)` at least every 2 minutes,
  otherwise the lobby is treated as abandoned and closed.
- Realtime: subscribe to `postgres_changes` (RLS-filtered) and use private
  channels `lobby:<uuid>` / `match:<uuid>` — broadcast is authorized by the
  WALRUS policies on `realtime.messages`.

## Key design decisions

- **Active membership uniqueness** — partial unique index on
  `(lobby_id, player_id) WHERE member_state NOT IN ('LEFT','KICKED')`
  (chosen over a deferrable constraint trigger: `member_state` is in the
  predicate, so every transition *into* an active state re-verifies
  uniqueness, and all RPC joins serialize on a `FOR UPDATE` lobby lock
  anyway). Rejoins reactivate the historic row instead of inserting a new
  one; kicked players are rejected with `LOBBY_NOT_JOINABLE/PLAYER_KICKED`.
- **Join-code uniqueness** — partial unique index on `join_code WHERE status
  NOT IN ('CLOSED','ENDING')`: codes are unique only among active lobbies and
  become reusable the moment a lobby closes (`code_release_at` records the
  release). Creation retries code collisions ~5 times; the code is never a
  key — the UUID is.
- **Host migration** — when the host leaves, the oldest remaining active
  member (`joined_at ASC, last_seen_at DESC`) inherits `is_host` and
  `multiplayer_lobbies.host_player_id`; empty lobbies are closed and their
  code released. A disconnected host can be replaced by any member
  (`migrate_multiplayer_host(lobby_id, NULL)`), while an explicit transfer
  requires the caller to be host. Match authority is separate:
  `migrate_match_authority` promotes the oldest *connected* match member and
  increments `authority_epoch` (clients ignore packets from old epochs).
- **Exit gate** — every join path locks the lobby row (`FOR UPDATE`) before
  counting active members, so capacity can never be exceeded, even under
  concurrent joins. Quick Join uses `FOR UPDATE SKIP LOCKED` so concurrent
  quick-joins fan out to different lobbies instead of blocking.

## The exit-gate test (fourth slot)

Seed lobby `10001` holds 3/4 members. Fire two simultaneous joins (e.g. two
browser tabs with different users calling `join_multiplayer_lobby` with the
lobby id, or `join_multiplayer_lobby_by_code('10001', '0.1.0', 1)`):

1. Transaction A takes the `FOR UPDATE` lock on the lobby row, counts
   3 active members (< 4), inserts the 4th member, commits, releases.
2. Transaction B was blocked on the same lock; it now re-reads the row,
   counts **4** active members, and returns `{"ok": false, "code":
   "LOBBY_FULL"}`.

Exactly one join can ever succeed — the row lock plus the under-lock count
is the gate. A fifth join attempt after the slot is taken also gets
`LOBBY_FULL`.

## Deployment notes / risks

- `pg_cron` must be enabled (Supabase: Database → Extensions). 0005 degrades
  to a `NOTICE` if unavailable — lobbies then rely on clients closing them.
- WALRUS policies assume the hosted Realtime inserts into
  `realtime.messages` as `authenticated`. Older/newer Realtime versions with
  custom authorization hooks should reuse `is_lobby_channel_member()` /
  `is_match_channel_member()`.
- Bump `protocol_version` on every wire-format change; all joins validate
  `game_version` + `protocol_version` server-side (`VERSION_MISMATCH`).
- The seed's placeholder player UUIDs are not real auth users — swap them
  for dev user ids before testing authenticated flows, and never run
  `seed.sql` outside a dev project.
- Policies use `SECURITY DEFINER` membership helpers to avoid RLS recursion;
  keep function ownership on `postgres` (do not re-own to a user role).
