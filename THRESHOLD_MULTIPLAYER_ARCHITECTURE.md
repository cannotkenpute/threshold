# THRESHOLD — Multiplayer Mode Architecture

## Document Purpose

This document defines the architecture for **THRESHOLD Multiplayer Mode**.

It is intended to be read directly by an AI coding agent and used as the implementation blueprint for multiplayer.

Multiplayer must:

- support **1–4 players per lobby**
- support **public lobbies**
- support **private lobbies**
- assign every active lobby a **5-digit join code**
- support a **global lobby browser**
- support **Quick Join**
- work reliably when the main game is deployed on **Vercel**
- work for players in different countries
- avoid depending on a permanently running Vercel Function
- minimize bandwidth and database writes
- support host migration where practical
- remain isolated from single-player unless shared systems are explicitly reusable

The initial multiplayer mode is designed for cooperative **Survival Mode**.

---

# 1. High-Level Architecture

Use the following architecture:

```text
                       ┌─────────────────────────────┐
                       │           VERCEL            │
                       │                             │
                       │  THRESHOLD Web Client       │
                       │  Next.js / Web Game         │
                       │                             │
                       │  API Routes / Functions     │
                       │  - create lobby             │
                       │  - join lobby               │
                       │  - quick join               │
                       │  - lobby browser            │
                       │  - start match              │
                       │  - leave lobby              │
                       └──────────────┬──────────────┘
                                      │
                                      │ HTTPS
                                      ▼
                       ┌─────────────────────────────┐
                       │          SUPABASE           │
                       │                             │
                       │ Postgres                    │
                       │ - lobbies                   │
                       │ - lobby members             │
                       │ - matches                   │
                       │ - persistent metadata       │
                       │                             │
                       │ Auth                        │
                       │ - guest/player identity     │
                       │                             │
                       │ Realtime                    │
                       │ - Broadcast                 │
                       │ - Presence                  │
                       │ - private room channels     │
                       └──────────────┬──────────────┘
                                      │
                             Realtime WebSocket
                                      │
                  ┌───────────────────┼───────────────────┐
                  ▼                   ▼                   ▼
             PLAYER 1            PLAYER 2            PLAYER 3
               HOST                                      │
                  └───────────────────┬───────────────────┘
                                      ▼
                                  PLAYER 4
```

## Core Principle

**Vercel is the application and API layer.**

**Supabase Realtime is the live multiplayer transport.**

Do not implement the primary multiplayer game loop by keeping a Vercel Function alive for the duration of a match.

Vercel Functions may support WebSocket connections, but Function lifetime/reconnect behavior makes them the wrong place for the authoritative long-running Survival Mode simulation.

The browser clients should connect directly to Supabase Realtime after lobby authorization.

---

# 2. Technology Roles

## Vercel

Vercel is responsible for:

- serving the game
- serving static game assets
- rendering menus
- lobby API endpoints
- matchmaking requests
- server-side validation
- secure lobby creation
- secure lobby joining
- generating lobby codes
- starting matches
- querying the public lobby browser
- returning temporary lobby/match authorization data
- protecting server-only secrets

Vercel is **not** responsible for:

- running a permanent 30+ minute match process
- storing a live tick loop in memory
- holding the only copy of current game state
- maintaining one Function instance per lobby
- relaying every movement packet through API routes

---

## Supabase Postgres

Postgres stores low-frequency persistent state:

- lobby metadata
- lobby privacy
- 5-digit codes
- host player ID
- lobby capacity
- member records
- lobby status
- region preference
- game version
- Survival Mode settings
- match records
- timestamps
- reconnect metadata

Do **not** write player position to Postgres every frame.

Do **not** use database rows as the movement transport.

---

## Supabase Realtime

Use Realtime for:

### Broadcast

Use Broadcast for:

- player transform packets
- animation state
- player actions
- item interactions
- monster state
- monster events
- Fear Factor events
- death/revive events
- match countdowns
- game start
- game end
- host authority packets
- host migration
- map events
- temporary effects

### Presence

Use Presence for:

- currently connected players
- player display names
- ready state
- connection state
- host presence
- ping category
- reconnect detection

### Private Channels

Every actual lobby/match channel must be private and membership-controlled.

Example topics:

```text
lobby:<internalLobbyUUID>
match:<internalMatchUUID>
```

Never use the public 5-digit code as the actual Realtime channel identifier.

---

# 3. Player Identity

Every multiplayer player requires a stable session identity.

Preferred options:

1. Supabase authenticated account
2. Supabase anonymous/guest session
3. Existing THRESHOLD account identity

A player should be able to play multiplayer without being forced to create a permanent account unless product requirements change.

Use:

```text
player_id = UUID
```

Never use:

- display name as identity
- IP address as identity
- lobby code as identity

Player display names are cosmetic and are not unique identifiers.

---

# 4. Lobby Types

There are two main lobby visibility types.

## Public Lobby

Properties:

```text
visibility = PUBLIC
max_players = 4
discoverable = true
join_by_browser = true
join_by_code = true
```

Public lobbies:

- appear in the global lobby browser
- can be joined through Quick Join
- can also be joined with their 5-digit code
- disappear from the browser after the match starts
- stop accepting players at 4 players

---

## Private Lobby

Properties:

```text
visibility = PRIVATE
max_players = 4
discoverable = false
join_by_browser = false
join_by_code = true
```

Private lobbies:

- do not appear in the global browser
- cannot be selected by Quick Join
- can only be entered using the 5-digit code
- still use authenticated Realtime membership
- stop accepting players at 4 players

A private lobby code is a convenience secret, not a strong security credential.

---

# 5. Five-Digit Lobby Codes

Every lobby receives a human-readable code.

Format:

```text
00000
```

through:

```text
99999
```

The code must always be exactly five numeric characters.

Examples:

```text
04217
91835
55002
```

Store codes as text, not integer, so leading zeros are preserved.

Database type:

```text
varchar(5)
```

Validation:

```regex
^[0-9]{5}$
```

---

## Internal Lobby ID

The 5-digit code is **not** the primary key.

Every lobby also receives:

```text
lobby_id = UUID
```

Example:

```text
join_code: 48217
lobby_id: 9be47c60-f621-4abb-a682-34d8d8b3c51a
```

The UUID is used internally.

The five-digit code is only for humans.

---

## Code Collision Handling

There are only 100,000 possible five-digit codes.

Therefore:

- uniqueness is required only among currently active/recently reserved lobbies
- generate codes server-side
- use cryptographically secure random generation
- attempt insert
- if unique constraint fails, generate another
- retry automatically

Recommended:

```text
MAX_CODE_GENERATION_RETRIES = 20
```

Active code uniqueness must be enforced by the database, not only application code.

Codes can be recycled after a lobby is closed and its cooldown has expired.

Suggested cooldown:

```text
15 minutes
```

---

## Code Brute-Force Protection

Private lobby codes should not be treated as passwords.

Apply protection to the join-by-code API:

```text
max failed attempts:
10 per minute per IP/session

temporary cooldown:
5 minutes after repeated failures
```

Never reveal whether a private code belongs to a banned/full lobby until basic rate-limit checks are complete.

---

# 6. Lobby Capacity

Hard limit:

```text
MAX_PLAYERS = 4
```

The lobby includes:

```text
1 host
0–3 additional players
```

Never rely on the UI alone to enforce capacity.

Joining must use an atomic database operation or transaction so two players cannot simultaneously take the fourth slot.

Pseudo-rule:

```text
if lobby.status != OPEN:
    reject

if active_member_count >= 4:
    reject

insert member atomically
```

---

# 7. Lobby State Machine

Use the following states:

```text
CREATING
OPEN
STARTING
IN_GAME
ENDING
CLOSED
```

Flow:

```text
CREATING
   │
   ▼
OPEN
   │
   ▼
STARTING
   │
   ▼
IN_GAME
   │
   ▼
ENDING
   │
   ▼
CLOSED
```

## CREATING

Short-lived state while database records and host membership are created.

## OPEN

Players may join.

## STARTING

Lobby is locked.

No new players may join.

Clients preload the level.

## IN_GAME

Survival match is active.

Lobby is removed from public discovery.

## ENDING

Results and cleanup are being processed.

## CLOSED

Lobby is no longer usable.

Code may eventually be recycled.

---

# 8. Player Lobby State

Each member has a state:

```text
JOINING
CONNECTED
READY
LOADING
PLAYING
DISCONNECTED
LEFT
KICKED
```

Suggested transitions:

```text
JOINING
   ▼
CONNECTED
   ▼
READY
   ▼
LOADING
   ▼
PLAYING
```

Disconnect:

```text
PLAYING
   ▼
DISCONNECTED
```

Reconnect:

```text
DISCONNECTED
   ▼
PLAYING
```

---

# 9. Lobby Host

Each lobby has one host.

Database:

```text
host_player_id UUID
```

The host may:

- start the match
- kick lobby members
- change Survival Mode settings
- choose map where applicable
- change public/private state before match
- close lobby

The host cannot:

- exceed player cap
- bypass server validation
- alter another user's identity
- manually grant arbitrary match state

---

# 10. Host Migration

Host migration is required.

## Before Match

If host disconnects while lobby is OPEN:

1. wait 5 seconds for reconnect
2. if host does not return, elect a new host
3. select the connected player with the oldest `joined_at`
4. update `host_player_id`
5. broadcast:

```text
host:changed
```

---

## During Match

The game uses lightweight host authority.

Every client caches recent authoritative snapshots.

Host sends:

```text
authority:snapshot
```

approximately every:

```text
2 seconds
```

The snapshot contains critical recovery state only:

- match clock
- random seed
- player status
- player Fear Factor
- player health/state
- inventory summaries
- monster states
- active item states
- consumed items
- objective state
- map mutation state
- event sequence number

If host disconnects:

1. freeze authoritative monster simulation briefly
2. wait up to 5 seconds for host reconnect
3. elect next connected player
4. new host loads the highest valid cached snapshot
5. broadcast new authority epoch
6. resume simulation

Example:

```text
authority_epoch: 12
authority_player_id: <uuid>
snapshot_sequence: 8842
```

Old host packets from a previous epoch must be ignored.

---

# 11. Authority Model

Use:

```text
HOST-AUTHORITATIVE CO-OP
```

This architecture is chosen because:

- only 4 players exist per match
- Survival Mode is cooperative
- it avoids requiring a dedicated persistent game server
- it works well with a Vercel-hosted web game
- it reduces infrastructure cost
- monster AI only runs once
- item decisions have one authority source

---

## Host Is Authoritative For

The host controls:

- monster AI
- monster positions
- monster targeting
- monster attacks
- item availability
- item pickup validation
- consumable use validation
- random drops
- random event seed
- Fear events
- player down/death state
- match timer
- survival scoring
- map mutation
- Crawling Mass progression
- game-over decision

---

## Local Client Is Immediately Authoritative For

To keep controls responsive, each client handles locally:

- local camera
- local mouse input
- local keyboard input
- local locomotion prediction
- local head bob
- local flashlight visuals
- local UI
- local audio

The host performs sanity checks on important gameplay state.

---

# 12. Network Model

## Do Not Send Every Render Frame

The game may render at:

```text
60–144 FPS
```

Network state must not be sent at render frequency.

---

## Player Transform Rate

Recommended starting point:

```text
10–15 updates/second
```

Packet includes:

```json
{
  "seq": 4211,
  "t": 1924451,
  "position": [12.4, 1.7, -8.1],
  "rotationY": 2.18,
  "pitch": -0.12,
  "velocity": [0.1, 0.0, 2.8],
  "movementState": "RUN"
}
```

Do not include redundant data.

---

## Monster Update Rate

Recommended:

```text
5–10 updates/second
```

Interpolate movement on remote clients.

Send immediate event packets for:

- attack
- aggro
- stun
- teleport
- death
- despawn
- target change

---

## Interpolation

Remote entities should render slightly behind network time.

Recommended initial interpolation buffer:

```text
100–150 ms
```

Remote player movement should interpolate between known snapshots.

Avoid snapping unless positional error becomes large.

---

## Extrapolation

Short extrapolation may be used during packet gaps.

Maximum recommended extrapolation:

```text
250 ms
```

After that:

- slow/freeze remote movement
- wait for next valid snapshot
- correct smoothly

---

# 13. Realtime Channels

Use one lobby channel before game starts:

```text
lobby:<lobby_uuid>
```

Use one match channel after match creation:

```text
match:<match_uuid>
```

Lobby channel handles:

- players joining
- players leaving
- Presence
- ready state
- lobby settings
- chat if added
- start countdown

Match channel handles:

- transforms
- item events
- monster events
- Fear Factor state
- match state
- host authority
- host migration
- reconnect
- game end

Channels must be private.

---

# 14. Realtime Event Namespace

Use consistent event names.

## Lobby

```text
lobby:sync
lobby:player_joined
lobby:player_left
lobby:ready_changed
lobby:settings_changed
lobby:kicked
lobby:starting
lobby:cancel_start
host:changed
```

## Player

```text
player:transform
player:animation
player:action
player:downed
player:revived
player:died
player:state
player:flashlight
```

## Inventory

```text
item:pickup_request
item:pickup_confirmed
item:pickup_rejected
item:drop_request
item:dropped
item:used
inventory:sync
```

## Monsters

```text
monster:spawn
monster:snapshot
monster:aggro
monster:attack
monster:event
monster:despawn
```

## Fear

```text
fear:event
fear:sync
fear:critical
```

## Match

```text
match:sync
match:start
match:pause_authority
match:resume_authority
match:end
match:checkpoint
```

## Authority

```text
authority:heartbeat
authority:snapshot
authority:migration_start
authority:migration_complete
```

---

# 15. Message Envelope

All Broadcast game packets should share a common envelope.

Example:

```json
{
  "v": 1,
  "type": "monster:snapshot",
  "matchId": "uuid",
  "senderId": "uuid",
  "authorityEpoch": 4,
  "seq": 9921,
  "sentAt": 1786912485123,
  "payload": {}
}
```

Required fields:

```text
v
type
matchId
senderId
seq
sentAt
payload
```

Authoritative messages additionally require:

```text
authorityEpoch
```

Ignore:

- malformed packets
- wrong match IDs
- invalid sender IDs
- stale sequence numbers
- packets from an old authority epoch

---

# 16. Database Schema

Recommended tables:

```text
multiplayer_lobbies
multiplayer_lobby_members
multiplayer_matches
multiplayer_match_members
```

---

## multiplayer_lobbies

Suggested columns:

```text
id UUID PRIMARY KEY

join_code VARCHAR(5)
host_player_id UUID

visibility ENUM/PUBLIC|PRIVATE

status ENUM/
    CREATING
    OPEN
    STARTING
    IN_GAME
    ENDING
    CLOSED

max_players SMALLINT DEFAULT 4

region VARCHAR
game_mode VARCHAR DEFAULT 'SURVIVAL'
map_id VARCHAR

difficulty VARCHAR
friendly_fire BOOLEAN DEFAULT false

game_version VARCHAR
protocol_version INTEGER

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
started_at TIMESTAMPTZ
closed_at TIMESTAMPTZ

code_release_at TIMESTAMPTZ
```

---

## multiplayer_lobby_members

Suggested columns:

```text
id UUID PRIMARY KEY

lobby_id UUID
player_id UUID

display_name VARCHAR

member_state VARCHAR

is_host BOOLEAN
is_ready BOOLEAN

joined_at TIMESTAMPTZ
last_seen_at TIMESTAMPTZ
left_at TIMESTAMPTZ

kick_reason VARCHAR NULL
```

Unique active membership:

```text
(lobby_id, player_id)
```

---

## multiplayer_matches

Suggested columns:

```text
id UUID PRIMARY KEY

lobby_id UUID

authority_player_id UUID
authority_epoch INTEGER DEFAULT 1

random_seed BIGINT

status VARCHAR

started_at TIMESTAMPTZ
ended_at TIMESTAMPTZ

result JSONB
```

---

## multiplayer_match_members

Suggested columns:

```text
match_id UUID
player_id UUID

joined_at TIMESTAMPTZ
disconnected_at TIMESTAMPTZ
reconnected_at TIMESTAMPTZ

final_score INTEGER
survival_time_ms BIGINT
result JSONB
```

---

# 17. Public Global Lobby Browser

The multiplayer menu must include:

```text
MULTIPLAYER

[ QUICK JOIN ]

[ PUBLIC LOBBIES ]

[ CREATE LOBBY ]

[ JOIN WITH CODE ]
```

---

## Global Lobby Browser

The browser lists OPEN public lobbies.

Example:

```text
HOST             PLAYERS     REGION       DIFFICULTY
----------------------------------------------------
KENDREW           3 / 4       US EAST      NORMAL
NOMAD             1 / 4       EUROPE       HARD
VOIDWALKER        2 / 4       ASIA          NORMAL
```

Recommended lobby card information:

- host display name
- player count
- region
- map
- difficulty
- approximate ping
- lobby age
- game version compatibility

Do not expose:

- internal player IDs
- database IDs
- IP addresses
- authentication tokens

---

# 18. Global Lobby Pagination

Do not load every lobby in one request.

Use cursor pagination.

Example:

```text
GET /api/multiplayer/lobbies?limit=25
```

Maximum:

```text
50
```

Return:

```json
{
  "lobbies": [],
  "nextCursor": "..."
}
```

Sort primarily by:

1. compatible game version
2. available slots
3. preferred region
4. approximate latency
5. creation time

---

# 19. Region System

Global discovery does not mean all matches should ignore geography.

Lobby region values:

```text
AUTO
US_EAST
US_WEST
EUROPE
ASIA
OCEANIA
SOUTH_AMERICA
```

Default:

```text
AUTO
```

When creating a lobby:

1. estimate the host's best region
2. store the preference
3. allow manual override later if desired

Supabase Realtime itself is globally distributed, so players can share a channel across regions.

The lobby's region is mainly used for:

- discovery ranking
- expected latency
- Quick Join
- UX

---

# 20. Quick Join

Quick Join finds the best valid public lobby.

Filters:

```text
status = OPEN
visibility = PUBLIC
player_count < 4
game_version compatible
protocol_version compatible
not banned
```

Ranking:

```text
1. preferred region
2. player count closest to 4
3. estimated latency
4. oldest valid lobby
```

The final join must still use the same atomic join operation as manual joining.

Never:

```text
query lobby
then separately insert player
```

without concurrency protection.

---

# 21. Create Lobby Flow

```text
PLAYER
  │
  ▼
POST /api/multiplayer/lobbies
  │
  ▼
VERCEL FUNCTION
  │
  ├── authenticate player
  ├── validate settings
  ├── generate UUID
  ├── generate 5-digit code
  ├── create lobby
  ├── insert host membership
  └── return lobby payload
  │
  ▼
CLIENT
  │
  ▼
connect to private Supabase lobby channel
  │
  ▼
publish Presence
```

Lobby should not become visible until host membership succeeds.

---

# 22. Join Public Lobby Flow

```text
PLAYER
  │
  ▼
select lobby
  │
  ▼
POST /api/multiplayer/lobbies/:id/join
  │
  ▼
atomic server-side join
  │
  ├── validate status
  ├── validate version
  ├── validate ban state
  ├── validate capacity
  └── insert member
  │
  ▼
return authorization
  │
  ▼
connect to lobby Realtime channel
```

---

# 23. Join Private Lobby Flow

User enters:

```text
48217
```

Request:

```text
POST /api/multiplayer/join-code
```

Body:

```json
{
  "code": "48217"
}
```

Server:

1. rate-limit request
2. validate exact five-digit format
3. find active lobby
4. confirm PRIVATE or PUBLIC lobby can accept code joins
5. validate capacity
6. validate game version
7. atomically add member
8. return safe lobby metadata
9. client joins Realtime channel

---

# 24. Ready System

Each non-host player can toggle:

```text
READY
NOT READY
```

Recommended starting rule:

Host may start when:

```text
all connected non-host players are READY
```

Optional setting:

```text
ALLOW_HOST_FORCE_START = false
```

Default should remain false.

Solo multiplayer lobby:

```text
1 / 4
```

may start if multiplayer Survival Mode supports solo hosting.

---

# 25. Match Start

Host presses:

```text
START
```

Server validates:

- host identity
- lobby OPEN
- player count 1–4
- ready requirements
- compatible client versions

Server then:

1. sets lobby to STARTING
2. creates match row
3. generates match UUID
4. generates random seed
5. sets host as initial authority
6. broadcasts starting event

Clients preload.

Each sends:

```text
player:loaded
```

When all active clients have loaded, or timeout occurs:

```text
match:start
```

Recommended loading timeout:

```text
30 seconds
```

---

# 26. Deterministic Match Seed

Generate a server-side random seed.

Example:

```text
random_seed = 839274928374
```

Use it for shared deterministic systems where practical:

- initial item placement
- initial monster placement
- loot selection
- ambient events
- procedural map choices

This reduces the amount of initial state that must be transmitted.

Do not assume every physics calculation will remain perfectly deterministic across browsers.

---

# 27. Monster Simulation

Only the current authority host runs full monster AI.

Non-host clients must **not independently decide monster behavior**.

Host simulates:

```text
pathfinding
target selection
attack timing
monster states
special abilities
Fear triggers
```

Host sends:

```text
monster:snapshot
```

Remote clients:

- interpolate monster transforms
- play local animations
- play local audio
- display local effects
- do not make authoritative AI decisions

---

# 28. Item Synchronization

Items need unique match-scoped IDs.

Example:

```text
item_000341
```

Player sees item and presses interact.

Client sends:

```text
item:pickup_request
```

Host validates:

- item still exists
- item not already consumed
- player is close enough
- player inventory has space
- player is alive

Host broadcasts:

```text
item:pickup_confirmed
```

All clients remove the item.

This prevents two clients from independently picking up the same item.

---

# 29. Fear Factor Synchronization

Fear Factor affects gameplay and therefore must not diverge significantly.

Recommended model:

- local client can calculate immediate visual/audio Fear effects
- host owns canonical gameplay Fear state
- Fear-causing world events are authoritative
- host periodically sends `fear:sync`

Canonical state:

```json
{
  "playerId": "uuid",
  "fear": 63.4,
  "health": 81.2,
  "state": "ALIVE"
}
```

Local UI may interpolate toward canonical values.

---

# 30. Disconnect Handling

A disconnected player is not immediately removed.

Reconnect window:

```text
60 seconds
```

On disconnect:

```text
member_state = DISCONNECTED
```

Player character may:

Option A:

```text
freeze in place
```

Option B:

```text
become temporarily invulnerable for 10 seconds,
then remain vulnerable
```

Recommended:

```text
10-second grace protection
then normal vulnerability
```

This prevents deliberate disconnect abuse while allowing brief network interruptions.

---

# 31. Reconnection

When reconnecting:

1. authenticate same player ID
2. find active lobby/match membership
3. reconnect to private Realtime channel
4. request authoritative snapshot
5. restore inventory
6. restore Fear Factor
7. restore player state
8. respawn player at last accepted position
9. resume play

Message:

```text
match:sync_request
```

Host replies:

```text
match:sync
```

---

# 32. Heartbeats

Realtime Presence detects connectivity, but gameplay authority should also have an application heartbeat.

Authority host sends:

```text
authority:heartbeat
```

approximately every:

```text
1 second
```

If clients receive no authority heartbeat for:

```text
3 seconds
```

mark authority as suspect.

At:

```text
5 seconds
```

begin migration.

---

# 33. Match Cleanup

When a match ends:

1. host sends proposed end state
2. server accepts final results endpoint
3. database marks match ENDED
4. lobby moves to ENDING
5. clients display results
6. lobby can either:
   - return to OPEN for another run
   - close

Recommended first implementation:

```text
Return to lobby after results.
```

Generate a new match UUID and new seed for rematch.

---

# 34. Security Model

## Never Trust the Browser With Secrets

Never expose:

- Supabase service-role key
- private server keys
- administrative database credentials

Public client configuration may include only values intended for browser use.

---

## Row Level Security

Enable RLS for multiplayer tables.

Users should only access:

- public metadata for discoverable lobbies
- their own membership
- rooms they are authorized to join

Realtime Broadcast and Presence channels should also validate room membership.

A random user must not be able to subscribe to:

```text
match:<uuid>
```

unless they are an active member.

---

# 35. Client Validation

Reject or ignore impossible data.

Examples:

```text
movement speed > allowed maximum
teleport distance > tolerance
invalid inventory count
pickup request through walls
wrong authority epoch
stale sequence number
wrong match ID
unknown player ID
invalid monster ID
```

This is not intended to provide tournament-grade anti-cheat.

It is intended to stop:

- accidental desync
- obvious packet manipulation
- malformed clients
- basic griefing

---

# 36. Version Compatibility

Every lobby stores:

```text
game_version
protocol_version
```

Example:

```text
game_version = "0.8.4"
protocol_version = 3
```

Clients may only join if multiplayer protocol versions are compatible.

This prevents an old cached Vercel deployment from corrupting a new match.

Display:

```text
VERSION MISMATCH
REFRESH THRESHOLD TO CONTINUE
```

---

# 37. Vercel Deployment Requirements

The implementation must be designed around Vercel's stateless/serverless behavior.

## Good Uses of Vercel Functions

Use Functions for:

```text
create lobby
join lobby
join by code
leave lobby
quick join
kick player
update lobby settings
start match
submit results
public lobby queries
```

These are short request/response operations.

---

## Bad Uses of Vercel Functions

Do not create:

```text
while (matchIsRunning) {
    runGameTick()
}
```

inside a Vercel Function.

Do not store critical multiplayer state only in:

```text
global variables
process memory
function-local maps
```

A new Function instance may receive the next request.

---

# 38. Suggested API Routes

Recommended route structure:

```text
/api/multiplayer/lobbies
/api/multiplayer/lobbies/create
/api/multiplayer/lobbies/quick-join

/api/multiplayer/lobbies/[lobbyId]
/api/multiplayer/lobbies/[lobbyId]/join
/api/multiplayer/lobbies/[lobbyId]/leave
/api/multiplayer/lobbies/[lobbyId]/ready
/api/multiplayer/lobbies/[lobbyId]/settings
/api/multiplayer/lobbies/[lobbyId]/kick
/api/multiplayer/lobbies/[lobbyId]/start

/api/multiplayer/join-code

/api/multiplayer/matches/[matchId]/result
```

The AI agent may adapt route names to the existing project structure.

---

# 39. Suggested Client Modules

Recommended architecture:

```text
src/
  multiplayer/
    MultiplayerManager.ts
    RealtimeTransport.ts
    LobbyManager.ts
    MatchManager.ts
    AuthorityManager.ts
    HostMigration.ts
    NetworkClock.ts
    SnapshotBuffer.ts
    NetworkInterpolation.ts
    MultiplayerInventory.ts
    MultiplayerMonsterSync.ts
    MultiplayerFearSync.ts
    MultiplayerPlayerSync.ts
    multiplayerTypes.ts
    multiplayerProtocol.ts
```

UI:

```text
src/
  ui/
    multiplayer/
      MultiplayerMenu.tsx
      PublicLobbyBrowser.tsx
      CreateLobbyModal.tsx
      JoinCodeModal.tsx
      LobbyScreen.tsx
      PlayerLobbySlot.tsx
      MultiplayerLoadingScreen.tsx
      MultiplayerDisconnectOverlay.tsx
```

---

# 40. MultiplayerManager

`MultiplayerManager` is the top-level multiplayer coordinator.

Responsibilities:

```text
player identity
current lobby
current match
connection lifecycle
Realtime connection
host status
authority status
disconnect state
reconnect state
```

It must expose clear state to the rest of the game.

Example:

```ts
multiplayer.isActive
multiplayer.isHost
multiplayer.isAuthority
multiplayer.lobby
multiplayer.match
multiplayer.players
multiplayer.connectionState
```

---

# 41. RealtimeTransport

All Supabase Broadcast calls should go through one transport abstraction.

Do not scatter raw Realtime calls throughout gameplay systems.

Interface concept:

```ts
transport.connectLobby(lobbyId)
transport.connectMatch(matchId)

transport.send(type, payload)
transport.on(type, handler)

transport.disconnectLobby()
transport.disconnectMatch()
```

This makes it possible to replace the networking provider later without rewriting the game.

---

# 42. Network Clock

Do not assume every player's system clock is identical.

Maintain:

```text
local monotonic time
estimated network offset
sequence numbers
```

Use relative game time for simulation.

Do not use client wall-clock time as authoritative gameplay time.

---

# 43. Packet Priorities

## Critical

Must be reliable at application level:

```text
match:start
match:end
item:pickup_confirmed
player:died
player:revived
host:changed
authority:migration_complete
```

Critical events should include unique event IDs.

Clients should ignore duplicates.

---

## Replaceable State

Old packets may be discarded:

```text
player:transform
monster:snapshot
flashlight orientation
look direction
```

If packet 502 arrives after 503:

```text
discard 502
```

---

# 44. Bandwidth Rules

Multiplayer must remain lightweight.

Do not transmit:

- full inventories every frame
- complete map state every frame
- full monster objects
- texture data
- mesh data
- audio
- static map information

All clients already have game assets from the Vercel deployment.

Network packets should primarily contain:

```text
IDs
transforms
state enums
small numeric values
events
```

---

# 45. Voice Chat

Voice chat is outside the initial multiplayer requirement.

If added later:

Use:

```text
WebRTC
```

Do not stream microphone audio through:

```text
Vercel Functions
Supabase Postgres
normal Realtime Broadcast packets
```

Supabase may be used for WebRTC signaling if desired.

---

# 46. Text Chat

Optional.

If implemented:

Use lobby/match Realtime Broadcast.

Requirements:

- max message length
- spam cooldown
- basic moderation hooks
- block/mute locally
- no HTML rendering

Recommended maximum:

```text
200 characters
```

---

# 47. Public Lobby Refresh

Do not continuously poll the database every frame.

Recommended browser behavior:

```text
initial fetch
+
manual refresh
+
automatic refresh every 10–15 seconds
```

Optionally subscribe to low-frequency lobby changes later.

The public lobby browser does not need frame-perfect realtime updates.

---

# 48. Empty Lobby Cleanup

If no connected members remain:

```text
mark lobby CLOSED
```

after grace period:

```text
60 seconds
```

A scheduled cleanup process should also close stale lobbies whose timestamps indicate abandonment.

Never allow abandoned OPEN lobbies to accumulate indefinitely.

---

# 49. Private Lobby UX

Create Private Lobby:

```text
PRIVATE LOBBY CREATED

CODE

4 8 2 1 7

[ COPY CODE ]

Waiting for players...

YOU
EMPTY
EMPTY
EMPTY

[ START ]
```

Join:

```text
ENTER LOBBY CODE

[ _ _ _ _ _ ]

[ JOIN ]
```

Only numeric input should be accepted.

Paste should be supported.

---

# 50. Public Lobby UX

Example:

```text
PUBLIC LOBBIES

Region: AUTO
Difficulty: ALL

────────────────────────────────────────

KENDREW'S LOBBY
3 / 4
US EAST
Normal
42 ms

[ JOIN ]

────────────────────────────────────────

VOID'S LOBBY
2 / 4
ASIA
Hard
117 ms

[ JOIN ]
```

If a lobby fills during join:

```text
LOBBY FULL
```

Then return user to browser without breaking menu state.

---

# 51. Four Player Lobby UI

Always render four slots:

```text
┌─────────────────────────────┐
│ PLAYER 1     HOST     READY │
│ PLAYER 2              READY │
│ PLAYER 3          NOT READY │
│ EMPTY                       │
└─────────────────────────────┘
```

Show connection problems:

```text
PLAYER 2
RECONNECTING...
```

---

# 52. Survival Mode Multiplayer Rules

Initial multiplayer implementation is for:

```text
SURVIVAL MODE
```

Shared:

- world
- monster population
- item spawns
- match timer
- environmental events

Per-player:

- inventory
- Fear Factor
- local camera effects
- flashlight battery
- health/state
- audio perspective

The authority host maintains canonical gameplay state.

---

# 53. Spawn System

At match start:

Players spawn:

```text
near one another
```

but should not occupy the exact same coordinate.

Use predefined spawn points:

```text
spawn_0
spawn_1
spawn_2
spawn_3
```

Host assigns players deterministically.

---

# 54. Player Collision

Recommended:

```text
disable hard player-vs-player collision
```

or use very soft collision.

Reason:

- less network jitter
- less blocking doorways
- easier synchronization
- reduced griefing

Players should not be able to trap one another in narrow corridors.

---

# 55. Friendly Fire

Default:

```text
false
```

If combat mechanics eventually exist, friendly fire may become a host setting.

Do not add unnecessary PvP assumptions to the initial architecture.

---

# 56. Error Codes

Use machine-readable multiplayer error codes.

Examples:

```text
LOBBY_NOT_FOUND
LOBBY_FULL
LOBBY_CLOSED
LOBBY_STARTING
INVALID_CODE
RATE_LIMITED
VERSION_MISMATCH
NOT_LOBBY_MEMBER
NOT_HOST
PLAYER_KICKED
REALTIME_CONNECTION_FAILED
MATCH_NOT_FOUND
RECONNECT_EXPIRED
```

UI converts codes to human-readable messages.

---

# 57. Connection State Machine

Client multiplayer network state:

```text
OFFLINE
CONNECTING
CONNECTED
DEGRADED
RECONNECTING
DISCONNECTED
FAILED
```

Never silently leave the game in a broken networking state.

Show a visible reconnect overlay when required.

---

# 58. Graceful Network Degradation

Short packet loss must not instantly end a match.

For remote players:

```text
continue interpolation
then short extrapolation
then freeze
```

For monster state:

```text
continue last known animation briefly
then freeze
```

Do not invent new authoritative attacks while disconnected.

---

# 59. Logging

Development logging should record:

```text
lobby created
lobby joined
lobby left
Realtime connected
Realtime disconnected
authority changed
host migration started
host migration completed
match started
match ended
protocol error
invalid packet
```

Do not log:

- auth tokens
- service keys
- private credentials

---

# 60. Metrics

Useful production metrics:

```text
active lobbies
active matches
players connected
average lobby size
join failures
full-lobby failures
invalid-code attempts
Realtime disconnect rate
host migration count
reconnect success rate
average match duration
```

These are operational metrics, not frame-level telemetry.

---

# 61. Testing Requirements

Before multiplayer is considered complete, test:

## Lobby

- create public lobby
- create private lobby
- join public lobby
- join by five-digit code
- code with leading zero
- invalid code
- full lobby
- simultaneous fourth-slot joins
- host leaves
- player leaves
- player kicks member
- ready states
- start match

## Networking

- four browser tabs
- four separate devices
- Wi-Fi disconnect
- mobile hotspot
- 200 ms simulated latency
- packet loss
- host disconnect
- host reconnect
- host migration
- non-host disconnect
- non-host reconnect

## Global

Test at minimum:

```text
North America ↔ North America
Europe ↔ Europe
Asia ↔ Asia
North America ↔ Europe
North America ↔ Asia
```

The last two may have noticeably higher latency, but the game must remain functional.

---

# 62. Browser Testing

Test multiplayer on current:

```text
Chrome
Firefox
Safari
Edge
```

Special attention:

- Safari background throttling
- tab suspension
- mobile browser lifecycle if mobile is supported
- WebGL context loss
- Realtime reconnect

---

# 63. Deployment Safety

Every multiplayer protocol change should update:

```text
protocol_version
```

Deployments must remain able to detect incompatible clients.

Never assume all four users loaded the exact same cached JavaScript bundle.

---

# 64. Suggested Environment Variables

Example:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY
MULTIPLAYER_PROTOCOL_VERSION
```

Server-only variables must never use:

```text
NEXT_PUBLIC_
```

Do not commit secret `.env` values to Git.

---

# 65. Implementation Order

The AI agent should implement multiplayer in this order.

## Phase 1 — Lobby Foundation

Implement:

```text
player identity
database schema
public lobby creation
private lobby creation
5-digit codes
join/leave
4-player cap
lobby UI
```

## Phase 2 — Realtime Lobby

Implement:

```text
private Realtime channel
Presence
ready states
host detection
host migration
```

## Phase 3 — Basic Match

Implement:

```text
match creation
loading
spawn
player transforms
remote player interpolation
```

Use placeholder capsules if necessary.

## Phase 4 — Survival State

Implement:

```text
items
inventory events
Fear Factor
health/state
match timer
```

## Phase 5 — Monsters

Implement:

```text
host-authoritative AI
monster snapshots
attacks
Fear events
```

## Phase 6 — Reliability

Implement:

```text
reconnect
authority snapshots
host migration during match
packet validation
version checks
cleanup
```

## Phase 7 — Global Browser

Finalize:

```text
pagination
region ranking
Quick Join
filters
latency display
```

---

# 66. Do Not Do These Things

The AI agent must not:

```text
use a Vercel Function as a permanent game server

write player coordinates to Postgres every frame

use the 5-digit code as a database primary key

trust client-reported monster state

let every client independently simulate authoritative monsters

put a Supabase service-role key in browser code

allow more than 4 active members in a lobby

expose private lobbies in global discovery

use display names as account IDs

send multiplayer updates at rendering FPS

restart the entire match because of a 1-second connection drop
```

---

# 67. Future Dedicated Server Upgrade

The transport and authority systems must remain modular.

If THRESHOLD eventually requires:

- competitive PvP
- stronger anti-cheat
- 8+ players
- extremely physics-heavy synchronization
- server-persistent worlds
- server-controlled enemy simulation independent of players

then replace host authority with a dedicated authoritative game server.

Possible future architecture:

```text
Vercel
   │
   ├── website
   └── matchmaking
        │
        ▼
Dedicated Room Server
        │
        ├── authoritative simulation
        └── WebSocket clients
```

The initial 4-player cooperative Survival Mode does not require this infrastructure.

---

# 68. Architectural Summary

The multiplayer stack should be:

```text
VERCEL
│
├── Web Game
├── Multiplayer UI
└── Short-Lived API Functions
       │
       ▼
SUPABASE
│
├── Auth
├── Postgres
└── Realtime
       │
       ▼
PRIVATE REALTIME ROOM
│
├── Player 1 — authority host
├── Player 2
├── Player 3
└── Player 4
```

Lobby discovery is global.

Lobby capacity is:

```text
4
```

Every lobby gets:

```text
UUID internal ID
+
5-digit human join code
```

Public lobby:

```text
browser + Quick Join + code
```

Private lobby:

```text
code only
```

Live gameplay:

```text
Supabase Realtime Broadcast
```

Connectivity:

```text
Supabase Presence
```

Persistent metadata:

```text
Supabase Postgres
```

Application/API hosting:

```text
Vercel
```

Game simulation:

```text
host-authoritative
```

This is the required baseline architecture for THRESHOLD Multiplayer Survival Mode.
