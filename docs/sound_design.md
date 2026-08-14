# SOUND DESIGN — 1980s BACKROOMS FIRST-PERSON HORROR

## Purpose

This document defines the sound design system for the web-based 3D retro horror game.

The game should use a **sound library / audio asset library** for most sound effects and ambient audio instead of relying on synthesized sound generation.

The audio system should make the Backrooms feel alive even when nothing is visibly happening.

Sound is one of the game's primary horror mechanics.

The player should constantly hear subtle audio cues that make them question:

- whether another person is nearby,
- whether a sound came from the environment,
- whether the Backrooms are reacting to them,
- whether they are walking in circles,
- whether something is following them.

The soundscape should remain restrained.

Avoid constant loud horror sounds.

Silence, repetition, distant noises, and subtle inconsistencies should create most of the tension.

---

# Audio Style

The overall sound design should combine:

- 1980s analog technology
- Fluorescent office ambience
- Industrial room tone
- Liminal environmental audio
- VHS and cassette artifacts
- Low-frequency mechanical noise
- Distant unexplained sounds
- Sparse entity audio
- Retro digital filtering
- Heavy environmental reverb where appropriate

The sound should feel slightly degraded and imperfect.

Audio should never sound too clean.

Use subtle processing such as:

- tape hiss
- wow and flutter
- light distortion
- band-limited EQ
- low-pass filtering
- high-frequency rolloff
- room reverb
- pitch variation
- volume variation
- playback speed variation

---

# Sound Library Requirements

Use a licensed or royalty-free sound library containing categories such as:

- fluorescent lights
- electrical buzz
- HVAC systems
- industrial ambience
- office room tone
- footsteps
- carpet footsteps
- wet footsteps
- water splashes
- metal impacts
- doors
- locks
- switches
- tape recorders
- cassette clicks
- radio static
- analog interference
- breathing
- cloth movement
- distant human voices
- scratches
- dragging sounds
- ventilation
- alarms
- mechanical machinery

Suggested asset organization:

```text
/audio
    /ambience
    /fluorescent
    /electrical
    /footsteps
    /water
    /doors
    /metal
    /items
    /cassette
    /radio
    /entity
    /chase
    /ui
    /facility
```

Every category should contain multiple variations whenever possible.

Example:

```text
/audio/footsteps/carpet/
    carpet_step_01.ogg
    carpet_step_02.ogg
    carpet_step_03.ogg
    carpet_step_04.ogg
    carpet_step_05.ogg
```

Never play the exact same sound repeatedly if several variations are available.

---

# Preferred Web Audio Format

Primary format:

- `.ogg`

Fallback:

- `.mp3`

Optional high-quality source assets:

- `.wav`

For the web build, compress large environmental loops to reduce bandwidth.

Short important sound effects can use higher quality.

---

# Audio Engine

The sound system may use:

- Web Audio API
- Howler.js
- Three.js positional audio
- Babylon.js audio
- another browser-compatible sound manager

The system must support:

- looping sounds
- positional 3D audio
- volume fades
- randomized playback
- pitch variation
- distance attenuation
- occlusion simulation
- low-pass filters
- layered ambience
- one-shot sound effects
- dynamic sound zones

---

# Master Audio Categories

Create separate mixer categories for:

```text
MASTER
├── AMBIENCE
├── ENVIRONMENT
├── PLAYER
├── ENTITY
├── MUSIC
├── VOICE
├── CASSETTE
└── UI
```

Allow each category to have independent volume control.

Recommended default balance:

- Ambience: high
- Environment: medium
- Player sounds: medium
- Entity sounds: low until danger begins
- Music: extremely low or absent
- Voice recordings: clear
- UI: subtle

---

# Core Principle

The player should almost always hear something.

However, the soundscape should not feel busy.

At any moment there should usually be:

1. one continuous environmental bed,
2. one or two nearby environmental loops,
3. occasional random distant sounds,
4. player-generated movement sounds,
5. rare unexplained noises.

---

# AMBIENCE SYSTEM

## Base Ambience Layer

Every room or zone should have a base ambient loop.

For the Yellow Sector, use:

- low HVAC rumble
- distant electrical hum
- subtle room tone
- faint low-frequency resonance

Example assets:

```text
ambience_yellow_base_01.ogg
ambience_yellow_base_02.ogg
ambience_yellow_base_03.ogg
```

Randomly choose one when entering a zone.

Crossfade between loops instead of abruptly changing them.

Crossfade duration:

```text
2 to 5 seconds
```

---

# Fluorescent Light Audio

Fluorescent lighting should be one of the most recognizable sounds in the game.

Each light fixture can emit a quiet loop.

Possible sounds:

- electrical buzz
- ballast hum
- faint flicker
- transformer vibration

Use several variations.

Example:

```text
fluorescent_hum_01.ogg
fluorescent_hum_02.ogg
fluorescent_hum_03.ogg
fluorescent_flicker_01.ogg
```

Do not give every light the exact same sound.

Pitch randomization:

```text
0.92x to 1.08x
```

Volume randomization:

```text
80% to 110%
```

Lights that flicker should occasionally trigger a brief electrical crackle.

---

# Fluorescent Horror Effect

In certain hallways, nearby fluorescent sounds should subtly change when the player approaches.

Examples:

- one light becomes louder,
- one light stops buzzing,
- one fixture develops a higher pitch,
- the hum begins oscillating,
- several lights suddenly become silent.

The player should notice the change without receiving an explicit warning.

---

# ROOM TONE

Different room types should have distinct acoustic profiles.

## Large Empty Rooms

Use:

- wider stereo ambience
- stronger reverb
- long reflections
- distant hum

## Narrow Hallways

Use:

- narrow sound field
- less bass
- shorter reflections
- stronger footstep echoes

## Maintenance Areas

Use:

- metal vibrations
- pipe noises
- ventilation
- occasional drips
- machine hum

## Carpeted Rooms

Use:

- muffled high frequencies
- soft footsteps
- low environmental reflections

---

# RANDOM AMBIENT EVENT SYSTEM

Create a randomized ambient event system.

Every few seconds, the game may evaluate whether to play a distant sound.

Suggested interval:

```text
8 to 30 seconds
```

Possible events:

- distant metal impact
- single footstep
- ventilation rattle
- electrical pop
- chair movement
- scraping sound
- water drip
- faint cough
- distant door closing
- short radio burst
- unidentifiable human murmur
- something falling several rooms away

Probability should depend on the current tension state.

Example:

```text
CALM:
10% event chance

UNEASY:
20% event chance

DANGER:
35% event chance
```

Do not trigger sounds constantly.

Long periods with no unusual event are important.

---

# RANDOM SOUND POSITIONING

Unexplained sounds should usually come from somewhere in the 3D environment rather than directly from the player's headphones.

Select a random valid location:

```text
distance: 8 to 35 meters
angle: randomized
```

Prefer positions:

- behind the player,
- beyond a wall,
- around a corner,
- in an adjacent room,
- above the ceiling,
- inside ventilation shafts.

Avoid always placing sounds directly behind the player.

Predictability reduces fear.

---

# PLAYER FOOTSTEPS

Footsteps should depend on surface type.

Surface categories:

- carpet
- wet carpet
- concrete
- metal
- tile
- shallow water

Each surface should contain multiple samples.

Example:

```text
footstep_carpet_01.ogg
footstep_carpet_02.ogg
footstep_carpet_03.ogg
footstep_carpet_04.ogg
```

Randomize:

```text
pitch: ±5%
volume: ±10%
```

Footstep speed should depend on:

- walking
- sprinting
- crouching

---

# WALKING ON CARPET

Carpet footsteps should be quiet and muffled.

This is important because it allows foreign footsteps to feel distinct.

The player may stop walking and hear another footstep continue.

This should be intentionally scripted at certain moments.

---

# WET CARPET AREA

Walking through water should combine two layers:

```text
FOOTSTEP
+
WATER SPLASH
```

The splash should be positional and synchronized with movement.

Occasionally after the player stops:

```text
wait 1.5 to 4 seconds
```

Play a single additional splash somewhere behind or beside them.

Do not show anything.

---

# PLAYER BREATHING

The player should not constantly breathe loudly.

Breathing becomes audible when:

- sprinting
- low health
- frightened
- hiding
- immediately after a chase

Use several breathing samples.

Avoid exaggerated horror breathing.

It should sound like a frightened but controlled human.

---

# STAMINA AUDIO

As stamina decreases:

1. footsteps become heavier,
2. breathing becomes louder,
3. heartbeat may subtly appear,
4. cloth movement becomes more noticeable.

Do not use a loud heartbeat during normal exploration.

---

# ITEM SOUNDS

Every interactive object should have a tactile sound.

Examples:

## Flashlight

```text
flashlight_click_on.ogg
flashlight_click_off.ogg
flashlight_battery_insert.ogg
```

## Cassette Recorder

```text
cassette_open.ogg
cassette_insert.ogg
cassette_close.ogg
cassette_play.ogg
cassette_stop.ogg
cassette_rewind.ogg
cassette_eject.ogg
```

## Medical Kit

```text
medkit_open.ogg
bandage_rustle.ogg
medical_item_use.ogg
```

## Inventory Pickup

Use physical object sounds instead of generic arcade pickup sounds.

Examples:

- battery plastic rattle
- bottle pickup
- paper rustle
- metal tool clink

---

# CASSETTE AUDIO SYSTEM

Cassette recordings are a major storytelling element.

Every tape should include:

- button click
- motor start
- tape hiss
- slight speed instability
- recorded voice
- occasional static
- motor stop

Example sequence:

```text
PLAY BUTTON CLICK
↓
TAPE MOTOR
↓
0.4 seconds hiss
↓
VOICE RECORDING
↓
hiss
↓
mechanical stop
```

Voice recordings should sound physically recorded on cassette.

Apply:

- reduced high frequencies
- mild compression
- light distortion
- tape hiss
- small pitch drift

Do not make the dialogue difficult to understand.

Atmosphere should not destroy intelligibility.

---

# TAPE HISS

Cassette hiss should be a dedicated looping asset.

Example:

```text
cassette_hiss_loop.ogg
```

Keep it at low volume underneath dialogue.

---

# RESEARCH FACILITY SOUND DESIGN

The opening laboratory should sound different from the Backrooms.

Facility sounds:

- computer fans
- tape machines
- CRT electrical noise
- printer mechanisms
- ventilation
- fluorescent lights
- paper handling
- distant conversation
- intercom static
- relay clicks
- mechanical switches
- analog clocks

The facility should feel populated even if only a few NPCs are visible.

---

# ANOMALY CHAMBER

Before entering the Backrooms, add a unique low-frequency dimensional sound.

This should be subtle.

Suggested layers:

- sub-bass hum
- electrical resonance
- reversed ventilation noise
- slow metallic vibration
- faint broadband static

When the player crosses the threshold:

Immediately cut most laboratory sounds.

Leave only:

```text
FLUORESCENT HUM
+
BACKROOMS ROOM TONE
```

The sudden loss of familiar sound should make the transition unsettling.

---

# ROPE SOUND

The expedition tether should have physical audio.

Possible sounds:

- rope dragging across carpet
- harness creaking
- metal carabiner movement
- rope tension
- rope sliding

While walking near the entrance, the player should occasionally hear the rope dragging behind them.

---

# ROPE BREAK EVENT

The rope separation is one of the most important opening sound moments.

Sequence:

1. fluorescent light flicker
2. distant metallic impact
3. rope tension sound
4. sudden low-frequency thump
5. rope sliding rapidly across carpet
6. silence
7. loose rope settles near player

Do not use a conventional "rope snapping" sound.

The rope was not physically cut.

The audio should imply something impossible happened.

---

# RADIO COMMUNICATION

The player's communication device should occasionally receive distorted transmissions.

Use:

- radio static
- frequency sweeps
- signal dropouts
- clipped voice fragments
- interference bursts

Possible fragments:

```text
"...come back..."
"...do you copy..."
"...wrong corridor..."
"...don't..."
```

Some transmissions may not be real.

Never clearly explain which are genuine.

---

# DISTANT HUMAN VOICES

Rarely use distant voice samples.

Rules:

- extremely low volume
- heavy reverb
- partially obscured
- difficult to locate
- no more than a few words

Examples:

```text
"Hello?"
"Wait."
"Over here."
"Evelyn?"
"Doctor?"
```

These should be used sparingly.

---

# ENTITY AUDIO PHILOSOPHY

The primary entity should initially have no recognizable monster sound.

Its audio should resemble distorted human movement.

Use sounds such as:

- uneven footsteps
- dragging cloth
- quiet breathing
- bone-like clicks
- faint vocal imitation
- scraping

The entity should become frightening because the player cannot tell whether it is human.

---

# ENTITY FOOTSTEPS

Entity footsteps should differ slightly from player footsteps.

Characteristics:

- inconsistent rhythm
- occasional missing steps
- variable distance
- unnatural pacing
- sudden stops

Example pattern:

```text
step
step
...
step
.....
step-step
```

The rhythm should not sound like a normal person walking.

---

# FOOTSTEP DECEPTION SYSTEM

Occasionally imitate the player's own footstep sounds.

Example:

Player walks:

```text
LEFT
RIGHT
LEFT
RIGHT
```

Player stops.

After 2 seconds:

```text
LEFT
RIGHT
```

from another corridor.

This creates the impression that something is copying the player.

Use this rarely.

---

# ENTITY VOICE MIMICRY

Later in Level 1, the entity may imitate researchers.

Use human voice recordings with subtle processing.

Apply:

- slight pitch mismatch
- tiny timing artifacts
- reversed reverb
- stereo instability
- occasional digital clipping

The voice should sound almost correct.

That is more disturbing than an obviously monstrous voice.

---

# FIRST SILHOUETTE ENCOUNTER

When the player sees the humanoid silhouette:

Reduce normal ambience gradually.

Lower:

- HVAC
- fluorescent hum
- environmental sounds

Introduce:

- faint low-frequency tone
- distant irregular breathing
- subtle electrical vibration

Do not use music.

The scene should feel unnaturally quiet.

---

# LIGHT SHUTDOWN SOUND

As fluorescent lights turn off down the corridor:

Each fixture should produce:

```text
electrical buzz
↓
brief crackle
↓
click
↓
silence
```

The shutdown should travel spatially toward the player.

The sound itself should communicate that darkness is approaching.

---

# FIRST CHASE SEQUENCE

During the first chase, sound replaces traditional horror music.

Use layered audio:

```text
PLAYER FOOTSTEPS
+
HEAVY BREATHING
+
ENTITY FOOTSTEPS
+
FLUORESCENT FAILURE
+
DISTANT IMPACTS
+
LOW INDUSTRIAL DRONE
```

The industrial drone should behave like music without becoming a conventional soundtrack.

---

# CHASE ENTITY AUDIO

During pursuit:

Entity footsteps should dynamically react to distance.

Far:

- faint running
- reverb
- occasional impact

Medium:

- louder irregular footsteps
- breathing
- scraping

Near:

- heavy foot impacts
- rapid breathing
- cloth movement
- distorted vocal sounds

Do not constantly play a monster roar.

---

# DYNAMIC CHASE INTENSITY

Use a variable:

```text
entityDistance
```

Example:

```text
30m+
minimal entity audio

15m–30m
distant pursuit sounds

5m–15m
clear footsteps and breathing

0m–5m
heavy impacts, distortion, intense breathing
```

Avoid abrupt changes.

Crossfade intensity layers.

---

# DOOR ESCAPE MOMENT

When the player slams the maintenance door:

Sequence:

1. door slam
2. metal latch
3. player's breathing
4. entity footsteps approach
5. footsteps stop directly outside
6. silence

Wait several seconds.

Then optionally:

```text
one quiet scratch against the door
```

Do not immediately use another jump scare.

---

# LEVEL 1 FINAL CAMP

The destroyed camp should sound almost completely silent.

Disable most random ambience.

Keep only:

- distant electrical hum
- very faint ventilation
- cassette equipment noise

The reduction in sound tells the player that this area is important.

---

# FINAL CASSETTE AUDIO

When Mercer says:

```text
"That isn't me."
```

all ambient sound should briefly cut out.

Allow approximately:

```text
1 second
```

of complete silence.

Then slowly restore environmental ambience.

---

# LEVEL END SOUND

As the lights turn off behind the player:

Use sequential fluorescent shutdown sounds.

Add a very low-frequency rumble from the new area ahead.

When the player crosses into Level 2:

Fade out Yellow Sector ambience.

Fade in industrial ambience.

Cut to black.

Use no dramatic musical sting.

---

# OCCLUSION SYSTEM

Sounds behind walls should be muffled.

When an audio source is blocked by geometry:

Apply a low-pass filter.

Example:

```text
unobstructed:
20000 Hz cutoff

one wall:
3500 Hz cutoff

multiple walls:
1200–2500 Hz cutoff
```

Reduce volume based on obstruction.

This makes audio useful for spatial navigation.

---

# DISTANCE ATTENUATION

Example environmental sound range:

```text
minimum distance: 1 meter
maximum distance: 30 meters
```

Entity sounds may travel farther:

```text
maximum distance: 50 meters
```

Large metal impacts may travel even farther.

---

# REVERB ZONES

Create reverb profiles.

## Yellow Rooms

Short, soft room reverb.

## Large Empty Rooms

Longer reflections.

## Maintenance Hall

Metallic reverb.

## Water Areas

Dampened high frequencies with reflective splashes.

## Research Facility

Cleaner controlled indoor reverb.

---

# SOUND RANDOMIZATION

For repeated sound effects, randomly vary:

```text
playbackRate = 0.95 to 1.05
volume = 0.9 to 1.1
```

For mechanical or fluorescent sounds:

```text
playbackRate = 0.9 to 1.1
```

Never randomize voice recordings enough to affect dialogue.

---

# REPETITION AVOIDANCE

Maintain a recent-sound history.

Example:

```text
recentSounds = last 3 samples
```

When selecting a new variation:

Do not choose a sample found in `recentSounds`.

This prevents obvious repetition.

---

# AMBIENT EVENT COOLDOWN

Each ambient event category should have a cooldown.

Example:

```text
distant_footstep:
20 seconds

metal_impact:
30 seconds

voice:
90 seconds

radio_signal:
45 seconds
```

This prevents horror effects from becoming predictable.

---

# SILENCE SYSTEM

Silence should be treated as an intentional sound state.

Occasionally reduce the environmental mix for several seconds.

Example:

```text
ambient volume drops to 20%
```

Possible trigger conditions:

- entering a new room
- discovering a clue
- approaching an entity
- entering a dangerous corridor
- finding an abandoned camp

Silence should signal that something has changed.

---

# MUSIC POLICY

Level 1 should contain almost no traditional music.

Music may appear only:

- during title screen
- opening credits
- level transitions
- specific scripted cinematic moments

Gameplay horror should rely primarily on environmental audio.

---

# TITLE SCREEN AUDIO

Suggested title screen sound:

- distant fluorescent hum
- cassette hiss
- very low analog synth drone
- occasional electrical interference

The sound should loop seamlessly.

---

# UI SOUND DESIGN

UI sounds should resemble physical 1980s equipment.

Examples:

## Menu Selection

Small mechanical click.

## Inventory Open

Paper folder or equipment case sound.

## Objective Update

Short CRT beep.

## Save / Checkpoint

Cassette mechanism click.

Avoid futuristic digital UI sounds.

---

# SAMPLE SOUND MANAGER LOGIC

Pseudocode:

```javascript
function playRandomSound(category, position) {
    const sounds = soundLibrary[category];

    const availableSounds = sounds.filter(
        sound => !recentSounds.includes(sound)
    );

    const selected =
        availableSounds[Math.floor(Math.random() * availableSounds.length)];

    const pitch = random(0.95, 1.05);
    const volume = random(0.9, 1.1);

    playPositionalAudio(selected, {
        position,
        pitch,
        volume
    });

    recentSounds.push(selected);

    if (recentSounds.length > 3) {
        recentSounds.shift();
    }
}
```

---

# RANDOM AMBIENT EVENT LOGIC

```javascript
function updateAmbientEvents() {
    if (ambientCooldown > 0) return;

    const chance = getAmbientEventChance();

    if (Math.random() < chance) {
        const event = chooseAmbientEvent();

        const position = chooseRandomNearbyPosition({
            minDistance: 8,
            maxDistance: 35
        });

        playRandomSound(event.category, position);

        ambientCooldown = random(8, 30);
    }
}
```

---

# SOUND LIBRARY CONFIGURATION EXAMPLE

```javascript
const soundLibrary = {
    fluorescent: [
        "audio/fluorescent/hum_01.ogg",
        "audio/fluorescent/hum_02.ogg",
        "audio/fluorescent/hum_03.ogg"
    ],

    carpetFootsteps: [
        "audio/footsteps/carpet_step_01.ogg",
        "audio/footsteps/carpet_step_02.ogg",
        "audio/footsteps/carpet_step_03.ogg",
        "audio/footsteps/carpet_step_04.ogg"
    ],

    distantMetal: [
        "audio/metal/distant_impact_01.ogg",
        "audio/metal/distant_impact_02.ogg",
        "audio/metal/distant_impact_03.ogg"
    ],

    entityFootsteps: [
        "audio/entity/step_01.ogg",
        "audio/entity/step_02.ogg",
        "audio/entity/step_03.ogg"
    ]
};
```

---

# PERFORMANCE RULES FOR WEB

Because the game runs in a browser:

- stream long ambience files when practical,
- preload short frequently used effects,
- avoid loading every audio file at startup,
- load audio assets by level,
- unload unused Level 1 assets after transitioning,
- compress long loops,
- use mono files for positional sounds,
- use stereo for global ambience when needed.

Recommended:

```text
Positional effects:
mono

Music / global ambience:
stereo
```

---

# AUDIO PRIORITY SYSTEM

When many sounds occur simultaneously, prioritize:

1. entity danger sounds
2. critical story dialogue
3. player movement
4. important environmental interactions
5. nearby environmental loops
6. distant random ambience

Low-priority sounds may be skipped when the mix becomes too dense.

---

# MAXIMUM SIMULTANEOUS SOUNDS

Suggested:

```text
global maximum:
24 to 32 active sounds
```

Positional environmental sources:

```text
12 to 16
```

Random ambient events:

```text
maximum 2 at once
```

Entity audio should always remain available.

---

# LEVEL 1 AUDIO STATES

Use an audio tension state machine.

```text
STATE 0 — SAFE
STATE 1 — UNEASY
STATE 2 — OBSERVED
STATE 3 — DANGER
STATE 4 — CHASE
STATE 5 — AFTERMATH
```

---

# STATE 0 — SAFE

Used during the beginning.

Audio:

- normal fluorescent hum
- HVAC
- rare random noises
- player footsteps

No entity sounds.

---

# STATE 1 — UNEASY

Triggered after discovering early research notes.

Add:

- occasional distant impacts
- unexplained footsteps
- subtle radio interference

---

# STATE 2 — OBSERVED

Triggered in deeper sections.

Add:

- copied footsteps
- subtle breathing
- distant silhouette audio
- environmental silence events

---

# STATE 3 — DANGER

Triggered near the final corridor.

Add:

- reduced ambience
- low-frequency drone
- irregular entity footsteps
- electrical instability

---

# STATE 4 — CHASE

Triggered during pursuit.

Add:

- sprint breathing
- entity running
- fluorescent failures
- environmental impacts
- intense industrial drone

---

# STATE 5 — AFTERMATH

Triggered after escaping through the maintenance door.

Remove:

- chase drone
- most entity sounds

Keep:

- player breathing
- distant ambience
- occasional scratch

Gradually return to normal environmental sound.

---

# IMPORTANT HORROR RULES

Do not:

- spam jump-scare sounds,
- constantly play monster noises,
- use loud music whenever danger is nearby,
- trigger the same distant sound repeatedly,
- make every unexplained noise lead to an actual threat.

Most strange sounds should have no immediate explanation.

The player should never know which sounds matter.

---

# FINAL AUDIO GOAL

The Backrooms should sound like an enormous building that should be empty but is not.

The player should frequently stop moving simply because they think they heard something.

The best sound events are not necessarily loud.

Sometimes the most frightening event should be:

```text
the player stops walking

but the footsteps continue
```
