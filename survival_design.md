# PROJECT THRESHOLD — SURVIVAL MODE DESIGN

## 1. MODE OVERVIEW

**Survival Mode** is an endless survival-focused game mode set within the DTE-04 spatial anomaly.

The player is a stranded Department of Spatial Anomaly researcher attempting to remain alive for as long as possible after losing access to Threshold A. Unlike the main story mode, Survival Mode is not centered on reaching a fixed extraction point. The primary objective is to manage limited supplies, locate temporary safe areas, endure increasingly hostile environmental conditions, and survive as long as possible.

The mode should feel oppressive rather than action-heavy. The player is not a soldier. The environment itself is the primary threat.

The defining mechanic is the **Fear Factor** system.

Monsters do not directly reduce the player's health. Instead, darkness, isolation, disturbing encounters, strange sounds, and exposure to anomalous areas increase Fear Factor. As Fear Factor rises, the player's physical condition begins to deteriorate.

The player survives by controlling fear, maintaining supplies, and continuously moving between temporary sources of safety.

---

# 2. CORE GAMEPLAY LOOP

The Survival Mode gameplay loop is:

1. Explore the current area.
2. Search rooms, containers, abandoned equipment, vehicles, lockers, desks, and DSA caches.
3. Gather survival supplies.
4. Monitor hunger, thirst, flashlight power, health, and Fear Factor.
5. Locate temporary light sources before darkness becomes dangerous.
6. Use short periods of safety to recover and organize supplies.
7. Leave before the light source fails.
8. Push deeper into the anomaly as resources become increasingly scarce.
9. Survive for as many cycles as possible.

The player should always feel that they are buying themselves **more time**, never establishing permanent safety.

---

# 3. PLAYER STATUS SYSTEMS

The player has five primary survival values:

- Health
- Fear Factor
- Hunger
- Thirst
- Flashlight Battery

These values are interconnected.

Survival should not become a simple collection of independent meters. Each system affects the others and creates pressure on the player.

---

# 4. HEALTH

## 4.1 Purpose

Health represents the player's overall physical condition.

Health ranges from:

**0 – 100**

At **0 Health**, the player dies.

## 4.2 Primary Rule

**Hostile entities do not directly damage Health.**

Instead, entities and disturbing environmental events increase Fear Factor.

Fear Factor is the primary mechanism through which danger becomes physical.

This makes encounters frightening even without traditional combat damage.

## 4.3 Health Loss

Health may decrease because of:

- Critical Fear Factor
- Prolonged starvation
- Severe dehydration
- Environmental hazards
- Falls
- Exposure to anomalous substances
- Special scripted events

The most common cause should be Fear Factor.

---

# 5. FEAR FACTOR

## 5.1 Overview

Fear Factor represents the player's psychological stability inside DTE-04.

Range:

**0 – 100**

At low levels, the player remains composed.

At high levels, the player's perception, movement, and physical condition begin to deteriorate.

The system should encourage the player to fear **remaining exposed**, not merely being attacked.

---

## 5.2 Fear Factor States

### 0–20 — CALM

The player is stable.

Effects:

- Normal vision
- Normal movement
- No health drain
- Normal ambient audio

---

### 21–40 — UNEASY

Minor symptoms begin.

Effects:

- Slight breathing increase
- Occasional distant noises
- Subtle camera movement
- Faster reaction to nearby anomalous sounds

No Health damage occurs.

---

### 41–60 — DISTRESSED

The player begins losing composure.

Effects:

- Noticeable breathing
- Light visual distortion
- Increased VHS interference
- Occasional false footsteps
- Flashlight feels less reliable
- Heartbeat becomes audible

Health remains mostly stable.

---

### 61–80 — PANIC

Fear becomes physically dangerous.

Effects:

- Health begins slowly draining
- Tunnel vision
- Increased camera instability
- Hallucinated movement at the edges of the screen
- False entity sounds
- Strong heartbeat
- Occasional momentary input hesitation

The player should strongly prioritize finding light.

---

### 81–100 — CRITICAL

The player is approaching psychological collapse.

Effects:

- Rapid Health loss
- Heavy breathing
- Strong visual distortion
- Audio becomes unreliable
- False doors or shadows may appear
- The player may hear fragments of Vaughn, Expedition 04 tapes, or distorted DSA radio chatter
- Lights may appear farther away or briefly flicker out

At **100 Fear**, the player does not instantly die.

Instead, Health begins draining rapidly until the player reaches safety or dies.

---

# 6. FEAR GENERATION

Fear increases through exposure to dangerous conditions.

## Primary Fear Sources

### Darkness

Darkness is the most consistent Fear source.

Standing in an unlit area continuously increases Fear Factor.

The longer the player remains in darkness, the faster Fear increases.

Example:

- First 30 seconds: slow increase
- 30–90 seconds: moderate increase
- 90+ seconds: rapid increase

This prevents players from comfortably wandering through darkness indefinitely.

---

### Entities

Entities do not physically damage the player.

Seeing, hearing, or being pursued by an entity causes Fear spikes.

Examples:

- Hearing distant footsteps: +3 Fear
- Hearing a nearby unexplained noise: +5 Fear
- Seeing an entity at long distance: +10 Fear
- Entity suddenly appearing nearby: +20 Fear
- Being chased: continuous Fear increase
- Losing sight of an entity after a chase: Fear remains elevated temporarily

An entity therefore remains dangerous even if it never touches the player.

---

### Isolation

Remaining away from recognizable landmarks for extended periods slowly increases Fear.

This should be subtle.

It reinforces the feeling that the player is becoming increasingly lost.

---

### Anomalous Events

Special events may cause Fear increases:

- Hallway geometry changing
- Lights suddenly shutting off
- Hearing one's own footsteps from another corridor
- Finding abandoned DSA equipment
- Hearing Expedition 04 recordings
- Seeing a doorway disappear
- Discovering impossible architecture
- Mimic voices
- Distant screams
- Radios activating without power

---

# 7. FEAR RECOVERY

Fear Factor decreases when the player reaches a **Safe Light Zone**.

Safe Light Zones are temporary areas illuminated by functioning light sources.

Examples:

- Emergency lamps
- DSA floodlights
- Generator-powered rooms
- Gas station lighting
- Vehicle headlights
- Battery-powered work lamps
- Fluorescent rooms that temporarily regain power

While standing inside a Safe Light Zone:

- Fear stops increasing
- Fear gradually decreases
- Breathing calms
- Visual distortion fades
- False sounds become less frequent
- Health drain caused by Fear stops

Health does **not** automatically regenerate unless a separate healing item or recovery mechanic is used.

---

# 8. TEMPORARY LIGHT SYSTEM

## 8.1 Core Rule

No Safe Light Zone is permanent.

During the Night Cycle, temporary light sources remain functional for only a few minutes.

The player should never be able to permanently camp in one location.

Typical duration:

**2–5 minutes**

Exact duration may be randomized.

This uncertainty is important.

The player should never know exactly when a supposedly safe room will become dangerous again.

---

## 8.2 Light Failure Warning

Light sources should provide subtle warning before shutting down.

Examples:

- Fluorescent flickering
- Generator sputtering
- Electrical buzzing becoming unstable
- Individual bulbs going dark
- Emergency lights turning red
- A DSA power indicator dropping

The player then has a brief decision window:

**Leave now or risk being trapped in darkness.**

---

# 9. DAY / NIGHT CYCLE

DTE-04 contains an artificial or unexplained environmental cycle that functions similarly to day and night.

The exact origin is unknown.

## Day Cycle

During the Day Cycle:

- More environmental lighting functions
- Fear accumulates more slowly
- Item spawn rates are higher
- Exploration is easier
- Entities are less active or less aggressive
- Safe areas last longer

Day should provide the player with an opportunity to prepare.

---

## Night Cycle

During the Night Cycle:

- Large portions of the environment lose power
- Permanent-looking lights begin failing
- Temporary Safe Light Zones become essential
- Fear accumulation increases
- Entity activity increases
- Item spawns become less common
- Batteries become significantly more valuable

Night is the primary survival phase.

The player should spend daytime gathering supplies specifically to endure the next night.

---

# 10. INVENTORY SYSTEM

Inventory is intentionally restrictive.

The player may carry a maximum of **5 units of each survival item type**.

Example:

| Item | Maximum |
|---|---:|
| Food | 5 |
| Water | 5 |
| Batteries | 5 |
| Medical Items | 5 |
| Special Utility Items | 5 per category |

The player cannot stockpile enormous quantities of supplies.

This forces continued exploration.

---

# 11. FOOD

Food controls Hunger.

Example food items:

- DSA ration packs
- Canned food
- Crackers
- Candy bars
- Vending machine snacks
- Sealed emergency meals
- Abandoned convenience-store food

Maximum carried:

**5**

Eating food restores Hunger.

Food should not directly restore Health unless a rare item specifically states otherwise.

---

# 12. WATER

Water controls Thirst.

Example water sources:

- Bottled water
- DSA emergency water
- Sealed canteens
- Water coolers
- Vending machines
- Abandoned supply crates

Maximum carried:

**5**

Thirst should decrease faster than Hunger.

This makes water one of the player's most consistently valuable resources.

---

# 13. BATTERIES

Batteries power portable equipment.

Primary use:

**Flashlight**

Maximum carried:

**5**

A fresh battery restores flashlight power.

Batteries become increasingly important during later Night Cycles as environmental lighting becomes unreliable.

Players should regularly face decisions such as:

- Use the flashlight now and explore safely
- Preserve battery power for night
- Search a dark room because it may contain supplies
- Wait inside temporary light and conserve batteries

---

# 14. FLASHLIGHT

The flashlight is the player's portable source of psychological safety.

While the flashlight is active:

- Darkness-based Fear accumulation is reduced
- Visibility increases
- Nearby environmental details become visible

However:

**The flashlight does not completely prevent Fear accumulation.**

A handheld flashlight is not psychologically equivalent to reaching a stable Safe Light Zone.

The player can still panic while walking through a dark corridor with only a flashlight.

This distinction is important.

Otherwise batteries would replace the entire Safe Light Zone system.

---

# 15. ITEM SPAWN DIFFICULTY

Survival Mode uses progressive scarcity.

Early gameplay should feel manageable.

The game gradually removes that comfort.

---

## Early Stage

Approximate cycles:

**Cycles 1–3**

Item availability:

HIGH

The player frequently discovers:

- Food
- Water
- Batteries
- Basic healing supplies

Purpose:

Teach mechanics and allow the player to establish a small reserve.

The player should initially think:

**"This might be manageable."**

---

## Intermediate Stage

Approximate cycles:

**Cycles 4–7**

Item availability:

MODERATE

Changes:

- Empty containers become more common
- Supply rooms may already be looted
- Food becomes less frequent
- Water is harder to locate
- Batteries become valuable
- Light sources fail sooner

The player begins consuming supplies faster than they can comfortably replace them.

---

## Late Stage

Approximate cycles:

**Cycles 8–12**

Item availability:

LOW

Changes:

- Long stretches contain no supplies
- Many loot locations are empty
- Batteries become rare
- Food may appear in dangerous locations
- Water may require exploring farther from safe areas
- Safe Light Zones become less frequent

The game changes from resource collection to resource triage.

---

## Extreme Stage

**Cycle 13+**

Item availability:

VERY LOW

The anomaly becomes increasingly hostile.

Possible behavior:

- Previously visited locations no longer contain supplies
- Some supply caches disappear
- Light cycles become shorter
- Night duration increases
- Darkness spreads faster
- Distant safe lights may shut off while approached
- High-value items appear near anomalous activity

Survival should become increasingly improbable.

There is no expectation that the player survives indefinitely.

---

# 16. SCARCITY FORMULA

A basic spawn model can use:

```text
Base Spawn Chance × Difficulty Multiplier
```

Example difficulty multipliers:

| Cycle | Multiplier |
|---|---:|
| 1 | 1.00 |
| 2 | 0.95 |
| 3 | 0.90 |
| 4 | 0.82 |
| 5 | 0.74 |
| 6 | 0.66 |
| 7 | 0.58 |
| 8 | 0.50 |
| 9 | 0.43 |
| 10 | 0.36 |
| 11+ | Continue gradual decline |

Rare emergency caches may ignore normal spawn probability.

This prevents the game from becoming mathematically impossible too early while still creating long-term scarcity.

---

# 17. SAFE LIGHT ZONE SPAWNING

Safe Light Zones should also become less reliable over time.

Early cycles:

- Numerous functioning rooms
- 4–5 minute duration
- Easy to spot from corridors

Middle cycles:

- Fewer illuminated rooms
- 3–4 minute duration
- Occasional flickering

Late cycles:

- Rare safe areas
- 2–3 minute duration
- May require activating a generator or replacing a fuse

Extreme cycles:

- Safe lights may last less than 2 minutes
- Some fail unexpectedly
- Some apparent safe areas may not reduce Fear

The player should gradually stop trusting light.

---

# 18. ENTITY DESIGN

Entities function primarily as **psychological pressure systems**.

They do not need conventional combat mechanics.

Their purpose is to:

- Force movement
- Separate players from Safe Light Zones
- Increase Fear
- Interrupt looting
- Cause players to waste batteries
- Push players into unexplored areas
- Make familiar routes unsafe

An entity chase can therefore be dangerous without a damage animation.

The danger is:

```text
Entity Encounter
      ↓
Fear Increase
      ↓
Player Runs Into Darkness
      ↓
Additional Fear Increase
      ↓
Player Misses Safe Zone
      ↓
Fear Reaches Critical
      ↓
Health Collapse
```

---

# 19. THE MIMIC IN SURVIVAL MODE

The mimic established in the main story can appear as a rare high-threat encounter.

Its primary ability is imitation.

Possible voices:

- Dr. Mercer
- Daniel Cole
- Vaughn
- The player's own radio
- Other DSA personnel

Example:

The player hears:

> "There's a light over here."

Following the voice may lead away from a Safe Light Zone.

Another possibility:

The player hears Vaughn say:

> "Proceed."

The voice comes from a completely dark corridor.

The player must decide whether audio information can be trusted.

---

# 20. RESOURCE LOCATIONS

Possible loot sources include:

### DSA Areas

- Research desks
- Lockers
- Security stations
- Medical rooms
- Storage crates
- Emergency cabinets
- Abandoned checkpoints
- Research backpacks

### Backrooms Areas

- Vending machines
- Maintenance rooms
- Utility closets
- Empty offices
- Kitchens
- Bathrooms
- Abandoned bags

### Later Levels

- Parked vehicles
- Highway patrol cars
- Gas stations
- Convenience stores
- Roadside buildings
- Abandoned camps

These locations connect Survival Mode to the environments established in the main game.

---

# 21. RANDOM EVENTS

Random events prevent players from developing perfect routes.

Possible events:

### Power Failure

Every nearby light immediately shuts off.

---

### False Power Restoration

A distant room suddenly illuminates.

It remains active for approximately 30 seconds before shutting down.

---

### Radio Transmission

An abandoned DSA radio activates.

Possible message:

> "...Threshold Control, respond..."

---

### Corridor Shift

The player turns around and discovers that the previous hallway has changed.

---

### Supply Cache

A rare intact DSA emergency cache appears.

Contains several valuable items.

---

### Mimic Transmission

A familiar character voice attempts to lure the player away from safety.

---

### Emergency Lighting

Red emergency lamps activate temporarily.

Fear accumulation slows but does not completely stop.

---

# 22. PLAYER DECISION PRESSURE

Every major system should force tradeoffs.

Example:

The player has:

- 1 water
- 2 food
- 1 battery
- 65 Fear
- 72 Health

A Safe Light Zone is currently active.

Across a dark hallway is a DSA storage room.

The player must decide:

**Stay in the light and reduce Fear**

or

**Use battery power to search the storage room before night worsens.**

Neither option should obviously be correct.

This uncertainty creates the survival experience.

---

# 23. DIFFICULTY ESCALATION

Difficulty should increase through environmental pressure rather than simply increasing enemy speed.

Progression should include:

- Fewer item drops
- Longer darkness periods
- Shorter Safe Light durations
- Increased Fear gain
- Longer nights
- More unstable geometry
- Increased entity frequency
- Less predictable power restoration
- More misleading sounds
- More dangerous loot placement

The environment itself becomes less hospitable.

---

# 24. SCORING

Survival Mode should track:

### Primary Score

**Time Survived**

Displayed as:

```text
SURVIVAL TIME
04:17:32
```

Additional statistics:

- Cycles survived
- Distance traveled
- Food consumed
- Water consumed
- Batteries used
- Safe Light Zones discovered
- Maximum Fear reached
- Entity encounters
- DSA artifacts recovered
- Expedition logs discovered

---

# 25. OPTIONAL ARTIFACT SYSTEM

Players may encounter classified DSA materials during Survival Mode.

These do not directly help survival.

Examples:

- Expedition reports
- Personnel IDs
- Research notes
- Black-site documents
- Vaughn memoranda
- Photographs
- Tape recordings

Collecting them unlocks entries in an **Archive** accessible from the main menu.

This creates an incentive to take risks even when the player already has enough supplies.

A document might be sitting deep inside an unlit room.

The player must decide whether lore is worth potentially losing the run.

---

# 26. SURVIVAL MODE DEATH

When Health reaches zero:

The screen should not immediately display a conventional game-over menu.

Instead:

1. Movement slows.
2. Breathing becomes unstable.
3. VHS distortion increases.
4. The player's flashlight begins failing.
5. Audio becomes muffled.
6. The screen fades toward darkness.

A final sound may play depending on the cause.

Examples:

- Fluorescent buzzing
- Distant footsteps
- Vaughn saying "Proceed."
- The mimic repeating the player's last heard voice line

Then:

```text
SIGNAL LOST
```

Followed by the run statistics.

---

# 27. DESIGN PHILOSOPHY

Survival Mode should avoid becoming a traditional monster survival game.

The central idea is:

**The player is not being killed by creatures. The player is being psychologically destroyed by the environment.**

Monsters exist to accelerate that process.

Darkness exists to accelerate that process.

Scarcity forces the player to enter darkness.

Temporary light provides relief but never permanent security.

The resulting gameplay loop is:

```text
EXPLORE
   ↓
GATHER
   ↓
DARKNESS
   ↓
FEAR
   ↓
FIND LIGHT
   ↓
RECOVER
   ↓
SUPPLIES DIMINISH
   ↓
MOVE AGAIN
```

Every cycle becomes slightly worse.

The player eventually understands that Survival Mode has no true safe state.

There are only temporary periods in which DTE-04 has not yet overwhelmed them.

---

# 28. CONNECTION TO PROJECT THRESHOLD LORE

Survival Mode uses the same world established in the main campaign.

The Department of Spatial Anomaly originally established permanent infrastructure beyond Threshold Point A, including research, housing, medical, power, communications, and holding facilities.

After the Threshold Failure, that infrastructure became scattered throughout DTE-04.

Survival Mode represents the player navigating remnants of that system.

This explains why the player can discover:

- Government supply caches
- Emergency lighting
- Research equipment
- Abandoned generators
- Food stores
- Batteries
- Medical items
- DSA documents

The further the player survives, the less intact the infrastructure becomes.

Eventually, the environment stops resembling an abandoned government installation and begins feeling like something much larger has absorbed it.

---

# 29. CORE SURVIVAL MODE PRINCIPLE

The player should constantly experience three competing thoughts:

**"I need supplies."**

**"I need light."**

**"I need to leave."**

The game should never allow the player to satisfy all three for long.
