# THRESHOLD — Master Survival Multiplayer Implementation Plan

## 1. Objective

Deliver a production-ready, 1–4 player cooperative Survival Mode that:

- Uses the existing vanilla Three.js game and streamed Level 1 environment.
- Uses all ten licensed Survival monster models.
- Uses Supabase Auth, Postgres, Realtime Broadcast, and Presence.
- Uses Vercel only for static hosting and short-lived API Functions.
- Supports public/private lobbies, five-digit join codes, Quick Join, reconnects, and host migration.
- Keeps Story Mode and the existing `EntityDirector` behavior unchanged.
- Keeps secrets server-only and never writes frame-level state to Postgres.

This plan supersedes implementation ordering in:

- `SURVIVAL_MONSTERS_IMPLEMENTATION_PLAN.md`
- `THRESHOLD_MULTIPLAYER_ARCHITECTURE.md`

Those documents remain the detailed behavior and architecture references.

---

## 2. Current Baseline

### Implemented

- Vanilla ES-module Three.js game served by `server.js`.
- Story Mode with procedural Level 1–3 content.
- Survival launch flow in `js/main.js`.
- `GAME_MODES.SURVIVAL`.
- `SurvivalState` with Hunger, Thirst, Fear Factor, cycle tracking, damage, and permadeath.
- Survival-only ration and water items.
- Survival HUD and death/results screen.
- Ten monster source assets, licenses, and metadata under:

```text
Assets/survival/monsters/<monster>/source/
Assets/survival/monsters/<monster>/metadata.md
```

- Local Supabase configuration:

```text
.env.local
.env.example
server/loadEnv.js
GET /api/public-config
js/multiplayer/supabaseClient.js
```

- `.env.local` is ignored by Git.
- Supabase Auth health, service-role REST access, and Postgres pooler DNS have been verified.
- Static server blocks `.env*`, Git metadata, internal tooling directories, and path traversal.

### Not implemented

- Processed runtime monster models.
- `SurvivalMonsterDirector`.
- Monster AI, navigation, spawn scheduler, or sensory-event system.
- Multiplayer database schema or RLS.
- Anonymous player identity.
- Lobby API, lobby UI, Quick Join, ready states, or join codes.
- Private Realtime channel authorization.
- Player transform synchronization.
- Host-authoritative Survival state.
- Host-authoritative monster simulation.
- Reconnection, snapshots, or host migration.
- Vercel deployment configuration for API Functions.
- Automated tests or multiplayer browser harness.

### Known prerequisite

The reported base-game runtime failure has not been reproduced to a verified root cause. Runtime stabilization is the first release gate. Do not build multiplayer on top of a game that cannot complete title-screen and Survival startup verification.

---

## 3. Non-Negotiable Architecture

### Client

Keep the current no-framework game:

```text
index.html
css/
js/
Assets/
```

Do not migrate the complete game to React or Next.js during this implementation.

### Vercel

Use Vercel for:

- Static game hosting.
- Short-lived `/api/multiplayer/*` Functions.
- Lobby validation and atomic RPC invocation.
- Server-only access to privileged Supabase credentials.
- Match creation and result submission.

Do not use a Vercel Function as a persistent game process or WebSocket relay.

### Supabase

Use:

- **Auth:** anonymous/guest identity, upgradeable to permanent accounts later.
- **Postgres:** lobbies, memberships, matches, metadata, results, and reconnect records.
- **Realtime Presence:** connected players, ready/loading state, and host visibility.
- **Realtime Broadcast:** transforms, items, monsters, Fear events, authority, and match events.
- **Private channels:** `lobby:<uuid>` and `match:<uuid>`.

Do not:

- Write player or monster transforms to Postgres every frame.
- Expose service-role, secret, JWT, or database credentials to browser code.
- Use the five-digit join code as a primary key or Realtime channel name.
- Let non-host clients authoritatively simulate monsters.

### Simulation

Use host-authoritative co-op:

- Host owns monster AI, match time, canonical Fear/health, item state, and map mutations.
- Each player owns immediate local input, camera, movement prediction, local visuals, and local audio.
- Remote clients interpolate transforms and render authoritative events.

---

## 4. Environment and Secret Contract

### Browser-safe

```text
NEXT_PUBLIC_threshold_SUPABASE_URL
NEXT_PUBLIC_threshold_SUPABASE_ANON_KEY
NEXT_PUBLIC_threshold_SUPABASE_PUBLISHABLE_KEY
MULTIPLAYER_PROTOCOL_VERSION
```

Only these values may be returned by `/api/public-config`.

### Server-only

```text
threshold_SUPABASE_SERVICE_ROLE_KEY
threshold_SUPABASE_SECRET_KEY
threshold_SUPABASE_JWT_SECRET
threshold_POSTGRES_DATABASE
threshold_POSTGRES_HOST
threshold_POSTGRES_PASSWORD
threshold_POSTGRES_PRISMA_URL
threshold_POSTGRES_URL
threshold_POSTGRES_URL_NON_POOLING
threshold_POSTGRES_USER
```

### Required security actions

1. Rotate the database password, service-role key, secret key, and JWT secret because they were shared in plaintext.
2. Replace local `.env.local` values after rotation.
3. Add corresponding Vercel environment variables for Development, Preview, and Production.
4. Confirm `.env.local` remains ignored.
5. Add CI secret scanning.
6. Never log tokens, connection strings, passwords, or full authorization headers.
7. Keep `.env.example` placeholder-only.

---

## 5. Target Source Layout

```text
api/
  public-config.js
  multiplayer/
    _shared/
      auth.js
      errors.js
      rateLimit.js
      response.js
      supabaseAdmin.js
      validation.js
    lobbies/
      index.js
      create.js
      quick-join.js
      [lobbyId]/
        index.js
        join.js
        leave.js
        ready.js
        settings.js
        kick.js
        start.js
    join-code.js
    matches/
      [matchId]/
        result.js
        reconnect.js

js/
  multiplayer/
    supabaseClient.js
    MultiplayerManager.js
    RealtimeTransport.js
    LobbyManager.js
    MatchManager.js
    AuthorityManager.js
    HostMigration.js
    NetworkClock.js
    SnapshotBuffer.js
    NetworkInterpolation.js
    MultiplayerPlayerSync.js
    MultiplayerInventory.js
    MultiplayerFearSync.js
    MultiplayerMonsterSync.js
    protocol.js
    types.js
  survival/
    SurvivalMonsterDirector.js
    MonsterAssetRegistry.js
    MonsterConfig.js
    EncounterScheduler.js
    SensoryEventBus.js
    SurvivalNavigationGrid.js
    MonsterBase.js
    monsters/
      Watcher.js
      Mimic.js
      Drifter.js
      Static.js
      HollowMan.js
      Grinner.js
      Surveyor.js
      CrawlingMass.js
      Echo.js
      Threshold.js
    network/
      MonsterAuthorityAdapter.js
      RemoteMonsterRenderer.js
      MonsterSnapshotCodec.js

supabase/
  migrations/
    0001_multiplayer_schema.sql
    0002_multiplayer_rls.sql
    0003_multiplayer_rpcs.sql
    0004_realtime_authorization.sql
    0005_cleanup_jobs.sql
  seed.sql

scripts/
  monsters/
    build-monster-assets.mjs
    validate-monster-manifest.mjs
  test/
    multiplayer-logic.mjs
    monster-logic.mjs

tests/
  multiplayer/
  survival/
```

The exact Vercel route file shape may be adjusted to match supported routing, but gameplay modules must not call privileged Supabase APIs directly.

---

## 6. Database Design

### Tables

#### `multiplayer_lobbies`

Required fields:

```text
id UUID PRIMARY KEY
join_code VARCHAR(5)
host_player_id UUID NOT NULL
visibility PUBLIC | PRIVATE
status CREATING | OPEN | STARTING | IN_GAME | ENDING | CLOSED
max_players SMALLINT DEFAULT 4 CHECK (max_players BETWEEN 1 AND 4)
region AUTO | US_EAST | US_WEST | EUROPE | ASIA | OCEANIA | SOUTH_AMERICA
game_mode VARCHAR DEFAULT 'SURVIVAL'
map_id VARCHAR DEFAULT 'LEVEL_1'
difficulty VARCHAR
friendly_fire BOOLEAN DEFAULT false
game_version VARCHAR NOT NULL
protocol_version INTEGER NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
started_at TIMESTAMPTZ
closed_at TIMESTAMPTZ
code_release_at TIMESTAMPTZ
```

#### `multiplayer_lobby_members`

```text
id UUID PRIMARY KEY
lobby_id UUID REFERENCES multiplayer_lobbies
player_id UUID NOT NULL
display_name VARCHAR
member_state JOINING | CONNECTED | READY | LOADING | PLAYING | DISCONNECTED | LEFT | KICKED
is_host BOOLEAN DEFAULT false
is_ready BOOLEAN DEFAULT false
joined_at TIMESTAMPTZ
last_seen_at TIMESTAMPTZ
left_at TIMESTAMPTZ
kick_reason VARCHAR
```

#### `multiplayer_matches`

```text
id UUID PRIMARY KEY
lobby_id UUID REFERENCES multiplayer_lobbies
authority_player_id UUID NOT NULL
authority_epoch INTEGER DEFAULT 1
random_seed BIGINT NOT NULL
status STARTING | ACTIVE | PAUSED_AUTHORITY | ENDED | ABORTED
game_version VARCHAR NOT NULL
protocol_version INTEGER NOT NULL
started_at TIMESTAMPTZ
ended_at TIMESTAMPTZ
result JSONB
```

#### `multiplayer_match_members`

```text
match_id UUID REFERENCES multiplayer_matches
player_id UUID NOT NULL
joined_at TIMESTAMPTZ
disconnected_at TIMESTAMPTZ
reconnected_at TIMESTAMPTZ
last_accepted_position JSONB
final_score INTEGER
survival_time_ms BIGINT
result JSONB
PRIMARY KEY (match_id, player_id)
```

### Constraints and indexes

- Five-character numeric join-code check.
- Unique active membership on `(lobby_id, player_id)`.
- Index public OPEN lobbies by region, version, player availability, and creation time.
- Enforce active join-code uniqueness in the database.
- Never rely on client-side player counts.
- Code reuse only after `code_release_at`.

### Atomic RPCs

Implement Postgres functions for race-sensitive operations:

```text
create_multiplayer_lobby
join_multiplayer_lobby
join_multiplayer_lobby_by_code
quick_join_multiplayer_lobby
leave_multiplayer_lobby
set_multiplayer_ready
start_multiplayer_match
migrate_multiplayer_host
close_stale_multiplayer_lobbies
```

RPC requirements:

- Validate authenticated `auth.uid()`.
- Lock the lobby row for capacity/state transitions.
- Enforce a maximum of four active members.
- Return machine-readable error codes.
- Generate or validate random seeds server-side.
- Reject incompatible protocol/game versions.
- Be idempotent where reconnection or retries are expected.

### RLS

- Anonymous/authenticated users may read safe fields for public OPEN lobbies.
- Lobby members may read their lobby and member rows.
- Match members may read their active match records.
- Users may update only their own ready/connection state through approved operations.
- Direct client inserts into authoritative match/result fields are prohibited.
- Service-role access is restricted to Vercel Functions and maintenance jobs.
- Realtime private-channel authorization must verify active lobby/match membership.

---

## 7. Shared Multiplayer Protocol

### Envelope

```json
{
  "v": 1,
  "type": "monster:snapshot",
  "matchId": "uuid",
  "senderId": "uuid",
  "authorityEpoch": 1,
  "seq": 1,
  "sentAt": 0,
  "payload": {}
}
```

Validation:

- Correct protocol version.
- Correct match ID.
- Known sender and active membership.
- Monotonically increasing sequence number per sender/type.
- Current authority epoch for authoritative packets.
- Bounded payload size and numeric ranges.
- Unknown fields ignored; malformed packets rejected.

### Critical events

Critical events require unique IDs and duplicate suppression:

```text
match:start
match:end
item:pickup_confirmed
item:used
player:downed
player:revived
player:died
host:changed
authority:migration_complete
monster:spawn
monster:attack
monster:despawn
```

### Replaceable state

Discard stale packets:

```text
player:transform
player:flashlight
player:animation
monster:snapshot
fear:sync
authority:heartbeat
```

### Update rates

```text
Local render:             60–144 FPS
Player transforms:        10–15 Hz
Monster snapshots:         5–10 Hz
Authority heartbeat:           1 Hz
Authority recovery snapshot: 0.5 Hz
Lobby browser refresh: every 10–15 s
```

Interpolation:

```text
buffer: 100–150 ms
maximum extrapolation: 250 ms
```

---

## 8. Monster Model Pipeline

### Source roster

| Cycle | Monster | Source model | Source state |
|---:|---|---|---|
| 1 | Watcher | Horror Humanoid Creature | Downloaded |
| 1 | Mimic | Mimic | Downloaded |
| 2 | Drifter | Cave monster | Downloaded; Standing clip |
| 2 | Static | Creeping Shadow Creature | Downloaded |
| 4 | Hollow Man | Hazmat Character Model | Downloaded |
| 4 | Grinner | The smile (Rigged) | Downloaded |
| 6 | Surveyor | The Fifth Knight | Downloaded |
| 6 | Crawling Mass | The Flesh | Downloaded |
| 8 | Echo | Void Stalker | Downloaded |
| 10 | Threshold | Crimson Eyehand Abomination | Downloaded |

### Processing output

For each monster:

```text
Assets/survival/monsters/<monster>/
  source/                 # preserved, unchanged
  processed/
    model.gltf
    model.bin
    textures/
  metadata.md
  runtime-manifest.json
```

### Processing rules

- Preserve source files and license text unchanged.
- Add/update attribution in `docs/THIRD_PARTY_ASSETS.md`.
- Process models using a reproducible script.
- Remove unused nodes, materials, accessors, and textures.
- Consolidate compatible materials.
- Generate normals/tangents where needed.
- Compress geometry only after cross-browser testing.
- Downscale runtime textures to 1024 px; Threshold may use 2048 px only if justified.
- Reduce Watcher, Mimic, Static, and Grinner below 50,000 triangles; target 25,000.
- Normalize scale, origin, forward axis, ground contact, and bounding capsule.
- Record clips, dimensions, triangle count, texture sizes, attribution, and source ID in `runtime-manifest.json`.
- Keep source and processed assets out of runtime memory until requested.

### Runtime registry

`MonsterAssetRegistry` must:

- Lazy-load GLTF assets.
- Cache one source asset per monster type.
- Clone animated models safely.
- Normalize materials for the retro renderer.
- Map expected clip names.
- Fall back to procedural motion when clips are absent.
- Expose loading/error state.
- Dispose per-instance mixers and cloned materials.
- Avoid disposing shared registry textures while active clones exist.

### Manifest validation

Fail validation for:

- Missing license or metadata.
- Missing processed GLTF/bin/texture.
- Triangle budget violation.
- Texture budget violation.
- Invalid model bounds.
- Missing required clip without a declared procedural fallback.
- Unrecognized license.
- Attribution missing from third-party documentation.

---

## 9. Survival Monster Runtime

### `SurvivalMonsterDirector`

Created only by `launchSurvivalMode()`.

Interface:

```js
start({ seed, authorityMode })
update(delta)
spawnDebug(type, position)
serializeAuthoritySnapshot()
restoreAuthoritySnapshot(snapshot)
dispose()
```

It must never be created in Story Mode.

### Shared systems

#### Encounter scheduler

- Seeded RNG.
- Evaluate every five seconds.
- Spawn 16–38 m from players.
- Reject direct line-of-sight spawns.
- Day cooldown: 45 seconds.
- Night cooldown: 25 seconds.
- Night doubles hostile weighting.
- Roaming cap:
  - Cycles 1–3: one.
  - Cycles 4–7: two.
  - Cycle 8+: three.
- Mimics and Crawling Mass use separate caps.

#### Sensory event bus

Events:

```text
player:footstep
player:sprint
player:flashlight
player:interaction
player:item_collected
player:route_cell
player:distress
```

Every event includes:

```text
playerId
position
intensity
gameTime
sequence
```

#### Navigation

- Extend `LevelBuilder` with chunk load/unload notifications.
- Build an incremental 1 m walkability grid from colliders.
- Maintain world-cell keys stable across streaming.
- Use bounded A*; never pathfind the entire world in one frame.
- Add local steering and stuck recovery.
- Remove navigation cells when chunks unload.
- Expose route-preservation checks for Crawling Mass.

#### Environmental light safety

Add:

```js
LightManager.getSafetyAt(position)
```

Only environmental fixtures affect Safe Light recovery. The player's flashlight does not count as a safe zone. Static and Threshold may temporarily suppress fixtures through reversible, reference-counted effects.

### Monster interface

Each monster implements:

```js
spawn(context)
update(delta, context)
onSensoryEvent(event)
serializeSnapshot()
applySnapshot(snapshot)
dispose()
```

Monsters modify Fear/sanity only. They do not call `takeDamage()`; health loss remains controlled by `SurvivalState`.

---

## 10. Monster Behavior and Multiplayer Authority

### Watcher

- Unlock: cycle 1.
- Moves only while not observed.
- Host evaluates player gaze and visibility.
- Sustained gaze/proximity emits canonical Fear events.
- Snapshot: position, facing, observed state, target, Fear pulse state.

### Mimic

- Unlock: cycle 1.
- Host replaces 8% of eligible supply pickups.
- False pickup keeps a match-scoped item ID.
- Interaction request is host-validated.
- Reveal consumes the false item and broadcasts a Fear spike.
- Snapshot/event: disguise item, reveal seed, state, despawn.

### Drifter

- Unlock: cycle 2.
- Patrols, investigates sensory events, chases loud players.
- Host owns pathfinding and target selection.
- Use embedded Standing clip plus procedural/retargeted locomotion.
- Snapshot: state, path segment, target, transform, velocity.

### Static

- Unlock: cycle 2.
- Creates local fixture failures, VHS interference, radio distortion, and extra flashlight drain.
- Host selects affected fixture IDs and duration.
- Clients render local audiovisual effects from an authoritative event seed.
- All suppressed fixtures restore on despawn/disconnect recovery.

### Hollow Man

- Unlock: cycle 4.
- Appears human at range; reveals abnormalities within 12 m.
- Host controls reveal and pursuit state.
- Clients derive cosmetic reveal effects from an event seed.

### Grinner

- Unlock: cycle 4.
- Spawns only in darkness.
- Flashlight exposure repels it.
- Host accumulates validated exposure time.
- Required exposure scales from 1.5 to 4 seconds across encounters.

### Surveyor

- Unlock: cycle 6.
- Searches rooms, noises, supply points, and last-known player positions.
- Never interacts with Story Mode doors.
- Host owns search plan and target priorities.

### Crawling Mass

- Unlock: cycle 6.
- Persists by stable world-cell key.
- Spreads every 90 seconds.
- Blocks no more than 15% of active walkable cells.
- Route validation must prove at least one path remains through each active chunk.
- Host broadcasts cell mutation deltas, not full meshes.

### Echo

- Unlock: cycle 8.
- Host keeps a rolling five-minute profile of repeated routes, safe zones, interactions, and supply visits.
- Intercepts the strongest repeated behavior.
- Profile data is match-memory only and must not contain personal identifiers.

### Threshold

- Unlock: cycle 10.
- At most once every two cycles.
- Duration: 20–35 seconds.
- Suppresses audio and environmental lighting.
- Uses non-colliding spatial illusions.
- Direct sight produces extreme Fear.
- Host sends event start, duration, seed, affected fixtures, and sight checks.
- Each client constructs deterministic cosmetic illusions locally.

---

## 11. Multiplayer Survival State

### Shared authoritative state

Host owns:

- Match clock and cycle.
- Encounter seed and scheduler state.
- Active monster states.
- Item existence, pickups, drops, and consumption.
- Crawling Mass cell mutations.
- Canonical Fear, health, alive/downed/dead state.
- Match score and end condition.

### Per-player state

Each player has:

```text
player ID
transform
movement state
inventory
flashlight battery/state
hunger
thirst
Fear
health
alive/downed/dead state
survival time
encounter counts
```

Local clients predict:

- Movement.
- Camera/head bob.
- Flashlight visuals.
- Immediate Fear presentation.
- Audio perspective.

Canonical values interpolate toward host syncs.

### Item authority

Flow:

```text
client -> item:pickup_request
host validates distance, visibility, existence, inventory capacity
host -> item:pickup_confirmed or item:pickup_rejected
all clients remove/retain item
```

Consumable use follows the same request/confirm pattern.

### Player collision

- Disable hard player-vs-player collision.
- Use remote-player capsules for monster visibility/targeting only.
- Spawn players at four deterministic nearby spawn points.

### Match results

Include:

- Survival time.
- Cycles survived.
- Total encounters.
- Per-monster encounter count.
- Items collected/used.
- Players revived/downed.
- Host migrations.
- End reason.

---

## 12. Lobby and Match UX

### Multiplayer menu

```text
MULTIPLAYER
[ QUICK JOIN ]
[ PUBLIC LOBBIES ]
[ CREATE LOBBY ]
[ JOIN WITH CODE ]
```

### Lobby

- Always show four slots.
- Public/private setting before match start.
- Region, difficulty, and map.
- Five-digit code with leading-zero support.
- Copy-code control.
- Ready state.
- Host badge.
- Kick control for host.
- Visible reconnect/degraded state.
- Start disabled until all connected non-host players are ready.

### Public browser

- Cursor pagination, 25 rows by default, 50 maximum.
- Refresh every 10–15 seconds plus manual refresh.
- Region and difficulty filters.
- Show safe metadata only.
- Quick Join uses the same atomic join RPC as manual join.

### In-game overlays

- Connection state.
- Reconnecting indicator.
- Authority migration pause.
- Player down/death status.
- Minimal teammate name/state markers.
- No numeric Fear display if existing Survival design intentionally keeps Fear implicit.

---

## 13. Host Migration and Recovery

### Heartbeats

- Authority heartbeat every one second.
- Mark host suspect after three seconds.
- Begin migration after five seconds.

### Authority snapshot

Every two seconds cache:

```text
match clock
cycle
RNG/scheduler state
players
inventories
Fear/health
items
monsters
map mutations
objectives
event sequence
authority epoch
```

### Migration

1. Pause authoritative monster decisions.
2. Wait up to five seconds for host reconnect.
3. Elect oldest connected member.
4. Increment authority epoch atomically.
5. New host selects the highest valid cached snapshot.
6. Broadcast migration completion.
7. Ignore all packets from older authority epochs.
8. Resume simulation.

### Reconnect

- Reconnect window: 60 seconds.
- Ten-second grace protection, then normal vulnerability.
- Restore identity, membership, inventory, Survival state, last accepted position, and match snapshot.
- Do not duplicate items or replay already-processed critical events.

---

## 14. Implementation Phases

### Phase 0 — Runtime stabilization

Tasks:

- Reproduce the current "game not working" report.
- Capture server output, browser console, failed network requests, and screenshot.
- Fix only verified startup/runtime causes.
- Confirm title screen, Story start, Survival start, movement, pointer lock, audio initialization, and level streaming.
- Preserve unrelated worktree changes.

Exit gate:

- No fatal console errors.
- No required startup asset 404s.
- Story and Survival both reach controllable gameplay.

### Phase 1 — Project and deployment foundation

Tasks:

- Add `package.json` and pinned dependencies/tooling.
- Add `vercel.json`.
- Add Vercel `/api/public-config`.
- Keep local `server.js` public-config behavior compatible.
- Add local API adapter or use `vercel dev`.
- Add lint/syntax/manifest scripts.
- Add protocol/game version constants.

Exit gate:

- Local and Vercel Preview serve identical public config without exposing secrets.

### Phase 2 — Supabase schema, Auth, RLS, and RPCs

Tasks:

- Create migrations.
- Enable anonymous Auth.
- Add multiplayer tables, indexes, constraints, RLS, and private-channel policies.
- Add atomic lobby/match RPCs.
- Add stale-lobby cleanup.
- Add seed/test fixtures.

Exit gate:

- Two simultaneous fourth-slot joins produce one success and one `LOBBY_FULL`.
- Unauthorized users cannot read private lobby/match rows or subscribe to channels.

### Phase 3 — Lobby API and UI

Tasks:

- Player identity initialization.
- Create public/private lobby.
- Join by browser/code.
- Leave, ready, kick, settings, start.
- Quick Join.
- Public browser and pagination.
- Machine-readable error mapping.

Exit gate:

- Four tabs can create, discover, join, ready, and start a lobby.

### Phase 4 — Realtime lobby and connection lifecycle

Tasks:

- `RealtimeTransport`.
- Private lobby channel.
- Presence.
- Lobby synchronization.
- Host election before match.
- Connection state machine.

Exit gate:

- Join/leave/ready/host state remains correct across refresh and brief disconnects.

### Phase 5 — Basic match and remote players

Tasks:

- Match creation and loading barrier.
- Deterministic spawn assignment.
- Player capsules/models.
- Transform packets at 10–15 Hz.
- Interpolation, short extrapolation, and correction.
- Network clock and sequence validation.

Exit gate:

- Four tabs can move in one streamed map without transform spam, persistent snapping, or hard collision.

### Phase 6 — Monster asset pipeline and shared runtime

Tasks:

- Process all ten models.
- Add runtime manifests.
- Validate licenses and budgets.
- Implement asset registry, chunk lifecycle, navigation grid, sensory events, light safety, and encounter scheduler.

Exit gate:

- Every monster model can debug-spawn, animate/fallback, unload, and dispose without console errors.

### Phase 7 — First monster release

Implement:

- Watcher.
- Mimic.
- Drifter.
- Static.

Order:

1. Validate behavior in solo Survival.
2. Add host authority serialization.
3. Add remote rendering and event replication.
4. Validate no Story Mode activation.

Exit gate:

- All four monsters work in solo and four-client sessions.
- Non-host clients do not run authoritative AI.

### Phase 8 — Multiplayer Survival authority

Tasks:

- Canonical Hunger, Thirst, Fear, health, cycle, items, death, and scoring.
- Pickup/use requests.
- Match end/results.
- Authority snapshots.

Exit gate:

- Forced packet loss and duplicate requests do not duplicate items or diverge canonical Survival state.

### Phase 9 — Full monster roster

Implement in unlock order:

- Hollow Man and Grinner.
- Surveyor and Crawling Mass.
- Echo.
- Threshold.

Exit gate:

- All ten monsters pass solo and multiplayer mechanic tests.
- Crawling Mass never seals all routes.
- Threshold effects cleanly restore lighting/audio.

### Phase 10 — Host migration and reconnect

Tasks:

- Authority heartbeat.
- Snapshot cache.
- Epoch migration.
- Reconnect restoration.
- Critical-event deduplication.

Exit gate:

- Host can disconnect during an active multi-monster encounter and another player resumes the match from a valid snapshot.

### Phase 11 — Production hardening

Tasks:

- Rate limiting.
- Payload/range validation.
- Version mismatch handling.
- Metrics and structured logging.
- Cleanup jobs.
- Cross-browser/cross-region testing.
- Performance and memory profiling.
- Vercel Preview and Production verification.

Exit gate:

- All final acceptance criteria pass.

---

## 15. Test Matrix

### Static and unit tests

- `node --check` across all JavaScript.
- Config and protocol validation.
- Monster manifest validation.
- Unlock cycles and active caps.
- Seeded encounter scheduling.
- Spawn distance and line-of-sight rejection.
- Navigation and stuck recovery.
- Mimic replacement and item authority.
- Crawling Mass route preservation.
- Echo rolling-profile selection.
- Direct-damage prohibition for monsters.
- Packet sequence/epoch validation.
- Critical-event duplicate suppression.
- Snapshot serialize/restore.

### Supabase tests

- Anonymous identity.
- Public/private visibility.
- Leading-zero codes.
- Code collision retry.
- Atomic fourth-slot joins.
- Ready/start validation.
- Host-only operations.
- RLS isolation.
- Private-channel authorization.
- Stale lobby closure.
- Result submission authorization.

### Browser tests

- Story Mode regression.
- Solo Survival.
- Four tabs.
- Four devices.
- Chrome, Firefox, Safari, Edge.
- 200 ms latency.
- Packet loss and reordering.
- Host disconnect/reconnect/migration.
- Non-host reconnect.
- Version mismatch.
- Model-loading failure.
- WebGL context loss.
- Background tab throttling.

### Long-run tests

- Fifteen-minute streamed Survival session.
- Minimum one complete cycle-unlock progression test.
- Repeated lobby create/join/close loop.
- Monitor:
  - scene object count
  - active animation mixers
  - audio nodes
  - lights
  - textures/geometries
  - Realtime subscriptions
  - event listeners
  - heap growth

---

## 16. Performance Budgets

```text
Average authoritative monster AI:       < 3 ms/frame
Player transform send rate:             <= 15 Hz
Monster snapshot send rate:             <= 10 Hz
Authority snapshot rate:                0.5 Hz
Monster runtime texture target:         1024 px
Heavy monster triangle ceiling:         < 50,000
Preferred heavy monster target:         ~25,000
Maximum roaming monsters:               3
Maximum players:                        4
Interpolation buffer:                   100–150 ms
Maximum extrapolation:                  250 ms
Reconnect window:                       60 s
```

Throttle expensive AI work:

- Spread pathfinding across frames.
- Reuse navigation paths until invalidated.
- Use distance/visibility-based update tiers.
- Disable mixers and effects outside relevance range.
- Send deltas/events instead of full state where possible.

---

## 17. Logging and Metrics

Log:

```text
lobby created/joined/left/closed
Realtime connected/disconnected
match started/ended
authority heartbeat timeout
host migration started/completed
reconnect attempted/succeeded/expired
protocol rejection
invalid packet
monster asset failure
monster spawn/despawn
snapshot restore
```

Never log:

```text
authorization tokens
service-role keys
database URLs/passwords
JWT secrets
complete private payloads
```

Metrics:

```text
active lobbies/matches
average lobby size
join failures
invalid-code attempts
Realtime disconnect rate
reconnect success rate
host migrations
average match duration
per-monster encounters
AI frame cost
asset load failures
```

---

## 18. Release Gates

### Alpha

- Base game stable.
- Supabase schema/Auth/RLS deployed.
- Public/private lobbies work.
- Four players enter one match.
- Remote players synchronize.
- Watcher, Mimic, Drifter, and Static work under host authority.

### Beta

- All ten monsters.
- Inventory/Fear/health authority.
- Reconnect and pre-match host migration.
- Public browser and Quick Join.
- Cross-browser testing.

### Release candidate

- In-match host migration.
- Rate limits and protocol hardening.
- Fifteen-minute leak test.
- Cross-region test.
- Vercel Preview and Production verification.
- No fatal console/network errors.
- No exposed secrets.

### Production definition of done

- 1–4 players can create or join public/private Survival lobbies globally.
- Every lobby has a valid five-digit code and internal UUID.
- Match simulation survives brief disconnects and host migration.
- All ten monster models and mechanics function under host authority.
- Story Mode behavior remains unchanged.
- Supabase RLS/private-channel tests pass.
- Browser and network degradation tests pass.
- AI, asset, bandwidth, and memory budgets pass.
- Deployment is verified through a live canonical route, not only a local build.

---

## 19. Execution Rule

Implement phases in order. Do not begin the next phase until the previous phase's exit gate is recorded as passed.

For every phase:

1. Record the exact files changed.
2. Run focused syntax/tests.
3. Run browser verification.
4. Capture console/network evidence.
5. Preserve unrelated dirty-worktree changes.
6. Update protocol version for breaking multiplayer changes.
7. Update this plan's completion checklist.

---

## 20. Completion Checklist

- [ ] Phase 0 — Runtime stabilization
- [ ] Phase 1 — Project and deployment foundation
- [ ] Phase 2 — Supabase schema, Auth, RLS, and RPCs
- [ ] Phase 3 — Lobby API and UI
- [ ] Phase 4 — Realtime lobby and connection lifecycle
- [ ] Phase 5 — Basic match and remote players
- [ ] Phase 6 — Monster asset pipeline and shared runtime
- [ ] Phase 7 — Watcher, Mimic, Drifter, and Static
- [ ] Phase 8 — Multiplayer Survival authority
- [ ] Phase 9 — Full monster roster
- [ ] Phase 10 — Host migration and reconnect
- [ ] Phase 11 — Production hardening
