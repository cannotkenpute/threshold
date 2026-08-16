# Fix Bugs / Logic / Gameplay Issues (Backrooms Horror Game)

## Context

A code review of the game (`js/**`, `server.js`, `index.html`) surfaced two concrete, verified defects:

1. **Dead audio cleanup logic** — `AudioManager` defines `notifyPlayerStopped()` twice
   (`js/audio/AudioManager.js:226` and `js/audio/AudioManager.js:274`). In a JS class, the
   second definition silently overwrites the first. The first (real) implementation cancels
   and fades out the currently-playing footstep gain node the instant the player stops moving;
   the surviving second definition only updates `isPlayerMoving`/`playerStoppedTime` and does
   *not* cut the sound off. Net effect: footsteps can trail on past the moment the player stops,
   which undercuts the footstep-deception horror mechanic described in `sound_design.md`.

2. **Consumable items are unusable** — `Inventory.useSlot()` (`js/items/Inventory.js:76`) is the
   only code path that invokes an item's `onUse` handler (battery recharge, almond water
   sanity/stamina restore, medkit full heal — all defined in `js/items/ItemTypes.js`). Nothing
   in the game ever calls `useSlot`. `InputManager` (`js/core/Input.js`) only maps number keys
   1–6 to `Inventory.selectSlot`, which *equips/holds* an item but never consumes it. Practical
   impact: the player can pick up and hold batteries/almond water/medkits, but has no way to
   actually use them — the flashlight can never be recharged in normal gameplay, breaking the
   battery-management survival loop that's central to the game's design (see
   `docs/backrooms_1980s_horror_game_level1_prompt.md`, "Flashlight Batteries" / "Survival Items").

Goal: fix both issues on an isolated branch, verify in-browser, then merge back into `main`.

## Branching Strategy

- Repo is currently on `main` with no other local/remote branches (per earlier `git status`).
- Create a feature branch off `main`: `git checkout -b fix/gameplay-and-audio-bugs`
- Make all fixes as separate, focused commits on this branch.
- After verification, merge back into `main` (see Merge Plan below).

## Fix 1: Duplicate `notifyPlayerStopped` in AudioManager

File: `js/audio/AudioManager.js`

- Delete the second, incomplete definition at line ~274-277 (the one that only sets
  `isPlayerMoving`/`playerStoppedTime`).
- Keep the first definition (~226-240), which additionally cancels scheduled gain values and
  ramps the active footstep node to silence (`this.activeFootstepNode.gainNode`).
- No other call sites need to change — `Player.js:392` (`this.audioManager.notifyPlayerStopped()`)
  and `AudioManager.update()`'s deception logic already assume the fuller behavior; this fix just
  makes the class actually deliver it.

## Fix 2: Wire up item consumption (`useSlot`)

Chosen interaction: **right-click (secondary mouse button) uses/consumes the item in the
currently active inventory slot.** This avoids overloading the existing 1–6 select bindings and
doesn't require a new HUD prompt beyond what already exists.

Files to change:

- `js/core/Input.js`
  - Add a `mousedown`/`mouseup` (or `contextmenu`-suppressing `mousedown` with `e.button === 2`)
    listener alongside the existing `pointerlockchange`/`mousemove`/`keydown` listeners in
    `initEvents()`.
  - On right-click press (while pointer-locked), call `this.onInteractKey('use_item')`, mirroring
    how `flashlight`/`interact`/`archive` actions are dispatched.
  - Prevent the browser context menu from opening during pointer lock (`e.preventDefault()` on
    `contextmenu`), consistent with the existing `ArrowUp/Down/Left/Right`/`Space` `preventDefault`
    handling already in this file.

- `js/main.js`
  - In `GameEngine.handleAction(action)`, add an `else if (action === 'use_item')` branch that
    calls `this.inventory.useSlot(this.inventory.activeSlotIndex, this.player)`, following the
    same pattern as the existing `slot_` branch.
  - `Inventory.useSlot` already plays a UI sound, decrements/clears the slot, updates the HUD via
    `hudManager.updateQuickSlots`, and clears the held-item model via `player.setHeldItem(null)`
    when the stack empties — no changes needed there.

- No changes needed to `js/items/Inventory.js` or `js/items/ItemTypes.js` — their `onUse` logic
  (`js/items/ItemTypes.js:14,28,42`) is already correct; it's just currently unreachable.

- Optional polish (only if it reads as confusing without it): update the interact-prompt hint in
  `index.html`/HUD so players know right-click uses a held consumable — e.g., extend
  `HUDManager.updateQuickSlots` or the static hint text near the quick-slots to mention
  `[RMB] USE ITEM`. Keep this minimal — a static hint line, no new systems.

## Out of Scope (flagged in review, not part of this fix)

- The unrelated `ignore/blackjack` prototype folder — leftover/untracked, not a bug in the
  shipping game. Leave untouched unless the user separately asks to remove it.
- No test suite exists for this project (no `package.json`, no test runner) — verification is
  manual/in-browser as described below.

## Verification

1. Start the dev server: `node server.js` (serves on `http://localhost:8080`, has hot-reload).
2. Load the game in a browser, start a run (or use the `[T]` dev teleport menu to jump directly
   to item pickups: `spawn`, or any Level 1/2 marker).
3. **Battery fix**: let the flashlight battery drain (or teleport with battery pre-drained via
   dev tools), pick up a battery pickup, select its slot, right-click to use it — confirm
   `battery-percent` HUD resets toward 100% and the "battery insert" UI sound plays.
4. **Almond water / medkit fix**: drain sanity/stamina (e.g. run with flashlight off in the dark
   for sanity drain, sprint for stamina drain), pick up almond water or medkit, select + right-click
   to use — confirm sanity/stamina bars move as expected (`ItemTypes.js` `onUse` values).
5. **Footstep cutoff fix**: walk, then stop abruptly while listening (or inspect via browser
   devtools breakpoint) — confirm the trailing footstep audio is cut short instead of ringing out,
   and that `AudioManager` only has one `notifyPlayerStopped` method (`grep -n
   notifyPlayerStopped js/audio/AudioManager.js` should show exactly one method definition plus
   its one call site in `Player.js`).
6. Sanity-check no regressions: normal slot selection (1–6) still equips/holds items correctly,
   flashlight toggle (`F`) and interact (`E`) still work, right-click doesn't fire while a modal
   (options/archive/cassette) is open.

## Merge Plan

1. Commit fixes on `fix/gameplay-and-audio-bugs` with clear messages (one commit per fix is fine).
2. After manual verification above passes, merge into `main`:
   - If working locally only: `git checkout main && git merge --no-ff fix/gameplay-and-audio-bugs`.
   - If a GitHub remote is configured and the user prefers a PR: push the branch and open a PR
     for review instead of merging directly — confirm which the user wants before merging.
3. Do not delete the feature branch or force-push anything without explicit confirmation.
