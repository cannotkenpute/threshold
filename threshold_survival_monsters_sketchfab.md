# THRESHOLD — Survival Mode Monster Asset Sourcing Spec

## Purpose

This file defines the monster roster and Sketchfab asset-sourcing rules for **THRESHOLD: Survival Mode only**.

An AI agent should use this document to:

1. Search Sketchfab for suitable monster models.
2. Select models that visually match each monster concept.
3. Prefer models that are directly downloadable and legally usable in the project.
4. Download/import the selected asset when the agent has authorized Sketchfab/API access.
5. Record the source, creator, license, and any required attribution.
6. Avoid modifying or adding monsters to the story/campaign mode.

The models do **not** need to match these concepts perfectly. The agent should prioritize atmosphere, readability, performance, and mechanical fit over exact visual similarity.

---

## Global Sketchfab Rules

### Source

Primary asset source:

- Sketchfab

The agent should search Sketchfab directly using the suggested search phrases below.

### Required Asset Conditions

Only select assets that satisfy all of the following:

- Download is enabled.
- License permits use in the project.
- License requirements are recorded before import.
- Commercial-use restrictions are respected if THRESHOLD is distributed commercially.
- Attribution is preserved when required by the model license.
- The asset can reasonably function in a real-time 3D game.
- Geometry can be reduced if necessary without destroying the silhouette.
- Textures can be converted/compressed for the game's retro visual style.
- Asset contains no obvious copyrighted franchise character unless the project has permission to use it.

### Preferred Formats

Prefer, in order:

1. GLB / GLTF
2. FBX
3. OBJ

If several formats are available, prefer the one preserving:

- armature
- animations
- materials
- texture references

### Performance Targets

Preferred monster asset targets:

- Low-poly or game-ready model.
- Ideally under 50,000 triangles before optimization.
- Prefer under 25,000 triangles.
- 1–4 material slots preferred.
- Texture resolution should normally be reduced to 512px–2048px depending on importance.
- Avoid extremely dense photogrammetry unless automatic optimization is available.

If the perfect visual model exceeds these targets, the agent may still select it if it can be decimated safely.

### Visual Style Conversion

THRESHOLD uses a retro, pixelized, degraded 3D horror style.

After import, monster assets may be modified through:

- texture downscaling
- nearest-neighbor texture filtering
- reduced color depth
- dithering
- vertex jitter
- PS1-style affine texture distortion
- low-resolution normal maps
- crushed shadows
- animation frame reduction
- intentional texture warping
- reduced polygon count

Do not reject an otherwise strong model because its original Sketchfab presentation is too realistic.

### Selection Priority

When multiple models are available, rank them using:

1. Mechanical readability
2. Horror silhouette
3. Downloadable license
4. Animation/rig availability
5. Performance
6. Texture quality
7. Visual uniqueness
8. Ease of modification

### Required Metadata

For every downloaded monster asset, save:

```text
Monster:
Sketchfab Model Name:
Sketchfab Model ID:
Creator:
Source URL:
License:
Attribution Required:
Original Triangle Count:
Imported Triangle Count:
Animations Included:
Textures Included:
Date Retrieved:
Local Asset Path:
Notes:
```

Store this information in the project's asset attribution/manifest file.

---

# Monster Roster

## 01 — The Watcher

### Gameplay Role

A tall humanoid that remains motionless while observed.

When the player looks away, it approaches.

Looking directly at it for too long increases Fear Factor.

The encounter forces the player to choose between:

- watching the creature
- navigating the environment
- allowing it to move closer

### Desired Appearance

Preferred characteristics:

- unnaturally tall
- thin humanoid
- long limbs
- featureless or obscured face
- disturbing but simple silhouette
- minimal clothing or deteriorated human clothing
- slightly disproportionate anatomy

Avoid:

- bulky monsters
- obvious fantasy demons
- brightly colored creatures
- recognizable franchise characters

### Sketchfab Search Queries

Search combinations such as:

```text
tall humanoid horror
skinny humanoid monster
liminal humanoid creature
faceless horror monster
long limb humanoid
low poly horror humanoid
creepy human creature
wendigo humanoid game ready
```

### Animation Requirements

Preferred:

- idle
- walk
- slow walk

Optional:

- head tilt
- twitch
- reaching animation

A static model is acceptable if procedural movement will be used.

### Selection Notes

The silhouette matters more than facial detail.

The monster should be recognizable at the far end of a corridor.

---

## 02 — The Mimic

### Gameplay Role

The Mimic disguises itself as something useful.

Possible disguises include:

- supply crate
- locker
- food item
- battery box
- door
- equipment case

When interacted with, it reveals its actual form and causes a major Fear Factor spike.

### Desired Appearance

The monster's revealed form should suggest that it has incorrectly reconstructed an object.

Preferred characteristics:

- fleshy object
- mouth hidden inside an object
- distorted container
- teeth
- organic growth
- creature emerging from furniture
- malformed mimic chest

### Sketchfab Search Queries

```text
mimic monster
mimic chest horror
flesh crate monster
living chest monster
object mimic creature
horror container monster
teeth box monster
organic mimic creature
```

### Animation Requirements

Preferred:

- closed/static disguise
- reveal/open
- bite
- idle creature state

### Selection Notes

A traditional fantasy mimic can be used if its texture/materials can be altered to look industrial rather than medieval.

The preferred final appearance should fit abandoned laboratories and Backrooms-like environments.

---

## 03 — The Drifter

### Gameplay Role

A roaming predator with poor vision and excellent hearing.

It reacts strongly to:

- running
- dropped objects
- metal doors
- equipment noise
- nearby impacts

The player is encouraged to move slowly and quietly.

### Desired Appearance

Preferred characteristics:

- hunched
- long arms
- deformed humanoid
- exposed ears or unusual sensory organs
- blind or covered eyes
- animalistic movement

### Sketchfab Search Queries

```text
blind humanoid monster
hunched horror creature
crawling humanoid horror
sound hunting monster
deformed humanoid creature
low poly mutant horror
long arm creature game ready
blind monster game ready
```

### Animation Requirements

Strong preference for:

- idle
- walk
- run
- attack

Useful extras:

- listening pose
- sniffing
- searching
- crawling

### Selection Notes

Rigged/animated models should be strongly preferred because this enemy continuously patrols the environment.

---

## 04 — The Hollow Man

### Gameplay Role

Appears to be a surviving member of the missing research team.

From far away, the player may believe the figure is human.

As the player approaches, anatomical abnormalities become visible.

The creature then begins hunting.

### Desired Appearance

Preferred characteristics:

- damaged scientist
- hazmat suit
- lab worker
- researcher
- human-like silhouette
- distorted proportions
- hidden face
- broken visor
- unnaturally long arms or neck

### Sketchfab Search Queries

```text
horror scientist
zombie scientist
hazmat horror
mutant hazmat
creepy researcher
abandoned lab monster
infected scientist
low poly hazmat character
horror laboratory worker
```

### Animation Requirements

Preferred:

- human idle
- slow walk
- chase/run
- attack

Optional:

- waving
- injured walk
- head twitch

### Selection Notes

This monster should look approximately human at medium-to-long range.

Models with a readable scientist, technician, or hazmat silhouette are ideal.

---

## 05 — The Static

### Gameplay Role

An entity associated with electronic interference.

Nearby effects include:

- flickering lights
- radio distortion
- flashlight battery drain
- screen interference
- electrical malfunction

The creature becomes increasingly visible through visual noise.

### Desired Appearance

Preferred characteristics:

- distorted humanoid
- shadow person
- electrical entity
- fragmented body
- glitch-like form
- black silhouette
- skeletal or wire-like anatomy

### Sketchfab Search Queries

```text
shadow humanoid monster
glitch horror creature
static monster
electrical humanoid
dark entity horror
black humanoid horror
distorted shadow creature
abstract humanoid monster
```

### Animation Requirements

Animation is optional.

Procedural shader distortion can provide most of the effect.

Preferred base animations:

- idle
- slow walk
- twitch

### Selection Notes

A visually simple asset is desirable because much of this monster's identity should come from shaders, lighting, and post-processing.

---

## 06 — The Grinner

### Gameplay Role

Lives primarily in darkness.

The player initially sees only:

- eyes
- teeth
- smile

A flashlight temporarily forces it away.

Each encounter requires increasingly sustained exposure to light.

### Desired Appearance

Preferred characteristics:

- extremely visible mouth
- oversized smile
- large teeth
- dark or black body
- hidden eyes
- thin humanoid silhouette

### Sketchfab Search Queries

```text
smiling horror monster
grinning humanoid
teeth monster horror
dark smiling creature
creepy grin monster
black humanoid teeth
smile creature horror
low poly smiling monster
```

### Animation Requirements

Preferred:

- idle
- approach
- attack
- recoil

### Selection Notes

The agent may select a full creature model even if only the face will normally be visible.

The final material should allow most of the body to disappear into darkness.

---

## 07 — The Surveyor

### Gameplay Role

An intelligent searcher that appears to be connected to the old research operation.

It systematically checks:

- rooms
- lockers
- corners
- doors
- hiding locations

It follows evidence left by the player.

### Desired Appearance

Preferred characteristics:

- damaged protective suit
- industrial exploration gear
- gas mask
- hazmat suit
- research uniform
- tactical flashlight
- old laboratory equipment

The creature should remain ambiguous:

It may be human, infected, artificial, or something imitating a researcher.

### Sketchfab Search Queries

```text
hazmat character
post apocalyptic scientist
gas mask scientist
horror hazmat character
researcher gas mask
low poly hazmat
industrial explorer character
abandoned laboratory worker
```

### Animation Requirements

Strong preference for:

- idle
- walk
- run
- interact
- inspect
- attack

Optional:

- flashlight pose
- door interaction
- searching animation

### Selection Notes

This monster should feel more intelligent than the rest.

Human-like rigs are highly desirable.

---

## 08 — The Crawling Mass

### Gameplay Role

An environmental organism rather than a conventional hunter.

It slowly spreads throughout the level.

It can:

- consume corridors
- block doors
- cover supplies
- make rooms inaccessible
- redirect player movement

The longer the survival run lasts, the more territory it consumes.

### Desired Appearance

Preferred characteristics:

- flesh growth
- fungal infestation
- tendrils
- organic wall growth
- roots
- tumor-like mass
- alien biomass

### Sketchfab Search Queries

```text
flesh growth horror
organic infestation
alien biomass
horror fungus
flesh wall
organic tendrils
mutant growth
creepy roots horror
biological infestation
parasite environment
```

### Animation Requirements

Not required.

Preferred assets:

- modular meshes
- tendrils
- wall growth
- floor growth
- organic decals

### Selection Notes

The agent may use several Sketchfab assets rather than one single model.

This entity should ideally be assembled from modular environmental pieces.

---

## 09 — The Echo

### Gameplay Role

An adaptive predator.

It learns repeated player behaviors.

Examples:

- frequent locker hiding -> begins checking lockers
- repeated routes -> intercepts those routes
- repeated door escapes -> waits near doors
- repeated room usage -> patrols those rooms

The creature becomes progressively more dangerous during long survival runs.

### Desired Appearance

Preferred characteristics:

- ambiguous humanoid predator
- distorted human form
- thin body
- expressive head movement
- recognizable silhouette
- visibly intelligent posture

### Sketchfab Search Queries

```text
stalker monster
humanoid predator horror
creepy humanoid creature
adaptive horror monster
thin mutant humanoid
low poly stalker monster
liminal horror creature
dark humanoid game ready
```

### Animation Requirements

Strong preference for:

- idle
- walk
- run
- attack

Optional:

- crouch
- inspect
- peek
- search

### Selection Notes

Animation quality is more important than fine visual detail because this enemy should appear deliberate and intelligent.

---

## 10 — The Threshold

### Gameplay Role

Rare high-threat entity.

Directly seeing the creature causes an extreme Fear Factor increase.

Its arrival causes environmental anomalies:

- hallways stretch
- doors disappear
- clocks stop
- lights fail
- ambient audio disappears
- geometry appears incorrect
- navigation becomes unreliable

The player survives primarily by avoiding direct visual contact.

### Desired Appearance

The exact form should remain difficult to understand.

Preferred characteristics:

- enormous humanoid
- impossible proportions
- abstract body
- floating limbs
- elongated anatomy
- distorted silhouette
- featureless entity
- eldritch but not overtly fantasy

### Sketchfab Search Queries

```text
abstract horror entity
eldritch humanoid
impossible humanoid creature
surreal horror monster
giant shadow humanoid
distorted humanoid entity
liminal entity horror
faceless giant creature
abstract monster game ready
```

### Animation Requirements

Optional.

The monster may rely primarily on:

- procedural motion
- shader deformation
- teleportation
- camera effects
- environmental distortion

### Selection Notes

Do not choose a visually over-detailed creature.

The player should never receive a clean, comfortable view of The Threshold.

Its design should remain partially unreadable even at close range.

---

# Asset Search Procedure

For each monster:

1. Search Sketchfab using every relevant query listed above.
2. Prefer models marked downloadable.
3. Open promising candidates.
4. Inspect:
   - license
   - model format
   - polygon count
   - textures
   - armature
   - animations
   - visual silhouette
5. Reject assets with incompatible licensing.
6. Reject obvious copyrighted franchise characters.
7. Rank the best 3 candidates.
8. Select the candidate that best fits gameplay and performance.
9. Download the asset if authorized.
10. Store attribution metadata.
11. Import into the Survival Mode monster asset directory.
12. Apply retro-style material/texture processing.
13. Test scale and silhouette in-game.
14. Do not integrate the asset into campaign/story mode.

---

# Recommended Project Structure

```text
/assets
    /survival
        /monsters
            /watcher
                /source
                /processed
                metadata.md
            /mimic
                /source
                /processed
                metadata.md
            /drifter
                /source
                /processed
                metadata.md
            /hollow_man
                /source
                /processed
                metadata.md
            /static
                /source
                /processed
                metadata.md
            /grinner
                /source
                /processed
                metadata.md
            /surveyor
                /source
                /processed
                metadata.md
            /crawling_mass
                /source
                /processed
                metadata.md
            /echo
                /source
                /processed
                metadata.md
            /threshold
                /source
                /processed
                metadata.md
```

---

# Survival Mode Restriction

These monsters belong exclusively to:

```text
THRESHOLD -> Survival Mode
```

Do **not** automatically:

- add them to the campaign
- rewrite campaign lore around them
- place them in story levels
- make them canonical entities
- connect them to campaign characters
- modify existing campaign encounters

Survival Mode may use monsters, mechanics, and assets that are not canon to the main THRESHOLD narrative.

---

# AI Agent Decision Rule

When the exact concept cannot be found on Sketchfab:

> Select the closest downloadable, legally compatible model whose silhouette and animations support the intended gameplay mechanic, then adapt its materials, textures, proportions, shaders, and presentation to fit THRESHOLD's retro horror aesthetic.

Gameplay function takes priority over literal visual matching.
