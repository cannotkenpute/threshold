# Survival Monster System Implementation

## Summary

Implement all ten monsters as a Survival-only system for the existing streamed Level 1 maze. Deliver shared infrastructure and four core monsters first, then complete the remaining six. Campaign behavior and `EntityDirector` remain unchanged.

## Key Changes

- Add `SurvivalMonsterDirector`, created only by `launchSurvivalMode()`, with `start()`, `update(delta)`, `dispose()`, and debug-spawn controls.
- Add a cached GLTF asset registry with animated cloning, loading states, model normalization, clip mapping, retro material processing, and safe failure handling.
- Extend `LevelBuilder` with chunk lifecycle notifications and walkability queries. Build an incremental 1 m navigation grid from existing colliders and use bounded A* plus local steering.
- Add Survival sensory events for footsteps, sprinting, flashlight use, item collection, interactions, and repeated route cells.
- Add `LightManager.getSafetyAt(position)` so environmental light—not the flashlight—controls Safe Light recovery. Monster effects may temporarily suppress specific fixtures.
- Centralize monster unlock cycles, spawn weights, speeds, fear rates, cooldowns, and active limits under `CONFIG.SURVIVAL.MONSTERS`.
- Monsters modify sanity/Fear only. They never call `takeDamage()`; health loss remains the responsibility of `SurvivalState`.

## Implementation

### 1. Assets and compliance

- Sketchfab sourcing and license verification completed through the MCP on 2026-08-16. All selected assets are CC BY 4.0 and stored under `Assets/survival/monsters/<monster>/source`.

| Monster | Selected Sketchfab model | Model ID | Source triangles | Embedded animation | Processing status |
|---|---|---|---:|---|---|
| Watcher | Horror Humanoid Creature | `b5874b20f8c34b919a52eb3cb7dad94c` | 95,786 | None | Decimate and downscale |
| Mimic | Mimic | `daec1bc608d640598b94700067382ecd` | 93,036 | None | Decimate, consolidate materials, downscale |
| Drifter | Cave monster | `4d78d918f0054e95b4cf8f1cbc7855f1` | 10,056 | Standing | Add locomotion and sensing motion |
| Hollow Man | Hazmat Character Model | `f331549106d84a3380fb31111299161e` | 9,344 | None | Add locomotion and reveal motion |
| Static | Creeping Shadow Creature | `53e77576ca0b4c5988ba2991a4bff075` | 99,197 | None | Decimate and downscale |
| Grinner | The smile (Rigged) | `6795ba0b406f4e61993fafebbb94ebd9` | 164,736 | None | Decimate and add recoil motion |
| Surveyor | The Fifth Knight | `b3011820639340c5812cdae329bc7a8f` | 16,572 | None | Downscale and add search locomotion |
| Crawling Mass | The Flesh | `47fb5fb4ea0640819e5a2b1a5696a120` | 9,663 | None | Downscale and derive modular variants |
| Echo | Void Stalker | `0758ec59a17144248f43a7ac6fcab559` | 20,266 | None | Add adaptive-predator locomotion |
| Threshold | Crimson Eyehand Abomination | `c27de05f75094cd681525a048613ba78` | 39,924 | None | Downscale and add procedural deformation |

- Preserve downloaded source files and licenses unchanged. Write optimized runtime GLTF files under each monster’s `processed/` directory.
- Reduce Watcher, Mimic, Static, and Grinner below 50,000 triangles; target 25,000 where silhouette loss remains acceptable.
- Downscale runtime textures to 1024 px. Keep 2048 px only for Threshold if visual testing shows the distortion effect requires it.
- Use the Drifter’s embedded Standing clip. Add procedural or authored idle/walk/run/search/attack motion for Hollow Man, Surveyor, and Echo; use procedural motion for the remaining static sources.
- Validate each processed model against its `metadata.md` and retain CC BY attribution in `docs/THIRD_PARTY_ASSETS.md`.

### 2. Runtime foundation and first release

- Use a seeded encounter scheduler checked every 5 seconds. Spawn threats 16–38 m away and outside direct line of sight.
- Limit roaming monsters to one in cycles 1–3, two in cycles 4–7, and three from cycle 8 onward. Mimics and Crawling Mass use separate caps.
- Use 45-second daytime and 25-second nighttime encounter cooldowns; night doubles hostile spawn weighting.
- Implement first:
  - **Watcher:** moves only while unobserved; sustained gaze and proximity raise Fear.
  - **Drifter:** patrols, investigates noise, and chases loud players using navigation paths.
  - **Mimic:** replaces 8% of eligible Survival supply pickups, reveals on interaction, applies a Fear spike, and consumes the false pickup.
  - **Static:** creates local light failure, VHS interference, radio distortion, and additional flashlight drain.
- Add deterministic debug spawning through `?survivalDebug=1`; keep controls unavailable in normal play.

### 3. Full roster

Unlock monsters progressively:

| Cycle | Monsters |
|---:|---|
| 1 | Watcher, Mimic |
| 2 | Drifter, Static |
| 4 | Hollow Man, Grinner |
| 6 | Surveyor, Crawling Mass |
| 8 | Echo |
| 10 | Threshold |

- **Hollow Man:** appears human at distance, reveals abnormalities within 12 m, then pursues and raises Fear.
- **Grinner:** spawns only in darkness; flashlight exposure repels it, with required exposure increasing from 1.5 to 4 seconds across encounters.
- **Surveyor:** searches rooms, supply locations, noises, and last-known player positions without interacting with campaign doors.
- **Crawling Mass:** persists by world-cell key, spreads every 90 seconds after cycle 6, blocks no more than 15% of active walkable cells, and never seals every route from a chunk.
- **Echo:** maintains a rolling five-minute profile of repeated routes, safe zones, interactions, and supply locations, then intercepts the strongest repeated behavior.
- **Threshold:** appears at most once every two cycles from cycle 10, lasts 20–35 seconds, suppresses audio and lighting, produces non-colliding spatial illusions, and causes extreme Fear on direct sight.
- Track per-monster encounters and include the total in the Signal Lost statistics.

## Test Plan

- Run `node --check` across every JavaScript module.
- Add a manifest validator covering licenses, metadata fields, file existence, triangle budgets, texture sizes, and required animation clips.
- Add seeded logic tests for unlock cycles, spawn caps, line-of-sight spawning, navigation, direct-damage prohibition, Mimic replacement, Crawling Mass route preservation, and Echo adaptation.
- Browser-test every monster through debug spawning for mechanics, animation, audio, Fear effects, cleanup, and asset-loading failures.
- Run a 15-minute streamed Survival session and verify unloaded chunks remove monsters, mixers, colliders, lights, audio nodes, and textures without growth.
- Verify campaign start, story entity behavior, progression triggers, and cutscenes remain unchanged.
- Acceptance requires no console/network errors and average monster AI work below 3 ms per frame with the maximum active roster.

## Assumptions

- Commercial-safe licensing is mandatory.
- All ten monsters are required, delivered through gated phases.
- Survival remains confined to the existing Level 1 procedural environment.
- Existing uncommitted title-screen audio changes are preserved.
- No backend, account persistence, multiplayer behavior, or campaign canon changes are included.
