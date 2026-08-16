/**
 * 1980s Retro Backrooms Horror - Master Configuration & Narrative Text
 */

export const CONFIG = {
  VERSION: '1.0.0 (1984.08)',
  
  // Display & Rendering
  VIRTUAL_WIDTH: 480,
  VIRTUAL_HEIGHT: 320,
  FOV: 68,
  NEAR_PLANE: 0.02,
  FAR_PLANE: 60.0,
  
  // Movement & Physics
  PLAYER: {
    WALK_SPEED: 2.4,
    SPRINT_SPEED: 4.6,
    CROUCH_SPEED: 1.3,
    ACCELERATION: 12.0,
    DECELERATION: 10.0,
    EYE_HEIGHT_STAND: 1.65,
    EYE_HEIGHT_CROUCH: 0.95,
    BOB_FREQUENCY: 7.5,
    BOB_AMPLITUDE: 0.045,
    MAX_HEALTH: 100,
    HEALTH_RECOVERY: 1.2,    // per sec when calm
    MAX_STAMINA: 100,
    STAMINA_DRAIN_SPRINT: 22, // per sec
    STAMINA_RECOVERY: 15,    // per sec
    MAX_SANITY: 100,
    SANITY_DRAIN_DARKNESS: 1.5,
    SANITY_DRAIN_PROXIMITY: 8.0,
  },
  
  // Flashlight & Battery System
  FLASHLIGHT: {
    MAX_BATTERY: 100,
    DRAIN_RATE: 0.75, // per sec (~130s total per battery)
    INTENSITY: 4.8,
    DISTANCE: 35.0,
    ANGLE: Math.PI / 2.8, // Wide 64-degree beam covering entire corridor
    PENUMBRA: 0.85,       // Soft edge falloff
    DECAY: 0.0,           // Non-quadratic uniform illumination
    COLOR: 0xffeed8,      // Warm 1980s incandescent bulb
    LOW_BATTERY_THRESHOLD: 25,
  },
  
  // Audio Mixer Volumes (sound_design.md)
  AUDIO_VOLUMES: {
    MASTER: 1.0,
    AMBIENCE: 0.85,
    ENVIRONMENT: 0.7,
    PLAYER: 0.65,
    ENTITY: 0.9,
    MUSIC: 0.3,
    VOICE: 0.95,
    CASSETTE: 0.8,
    UI: 0.5,
  },
  
  // 10-Minute Day/Night Grid Power Cycle (600s total)
  DAY_NIGHT_CYCLE: {
    TOTAL_DURATION: 600,  // 10 minutes
    DAY_DURATION: 360,    // 6 minutes of full fluorescent lighting
    DUSK_DURATION: 20,    // 20 seconds of brownout flicker
    NIGHT_DURATION: 200,  // 3.3 minutes of blackout
    DAWN_DURATION: 20,    // 20 seconds of ignition flicker
  },

  // Performance & frame-pacing tunables
  PERF: {
    PHYSICS_HZ: 120,               // fixed player simulation rate
    MAX_PHYSICS_STEPS: 6,          // per-frame spiral-of-death guard
    CHUNK_FRAME_BUDGET_MS: 3.0,    // wall-clock budget for streamed chunk generation per frame
    HUD_UPDATE_INTERVAL: 0.1,      // seconds between throttled HUD refreshes (10Hz)
    RAYCAST_EVERY_N_FRAMES: 3,     // interaction-focus raycast cadence
    RENDER_SCALE_DEFAULT: 0.5,     // 3D scene render-target scale (retro low-res + GPU headroom)
  },

  // Survival Mode: bounded reuse of Level 1 with day/night-driven item scarcity
  SURVIVAL: {
    HUNGER_DRAIN_RATE: 100 / 480,   // per sec (~8 min to empty)
    THIRST_DRAIN_RATE: 100 / 300,   // per sec (~5 min to empty)
    STARVE_DAMAGE: 0.5,             // HP/s while hunger is at 0
    DEHYDRATE_DAMAGE: 0.5,          // HP/s while thirst is at 0
    PANIC_DAMAGE: 0.4,              // HP/s while Fear Factor is in PANIC (61-80)
    CRITICAL_DAMAGE_MIN: 0.6,       // HP/s at the start of a CRITICAL Fear Factor streak (81-100)
    CRITICAL_DAMAGE_MAX: 1.5,       // HP/s after 15s of continuous CRITICAL Fear Factor
    CRITICAL_RAMP_DURATION: 15,     // seconds to ramp from MIN to MAX damage
    SAFE_LIGHT_RECOVERY_RATE: 5.0,  // Sanity/s at full environmental-light safety
    MONSTERS: {
      MANIFEST_ROOT: './assets/survival/monsters',
      SCHEDULER_INTERVAL: 5,
      DAY_COOLDOWN: 45,
      NIGHT_COOLDOWN: 25,
      SPAWN_DISTANCE_MIN: 16,
      SPAWN_DISTANCE_MAX: 38,
      NAV_CELL_SIZE: 1,
      NAV_MAX_NODES: 1200,
      TYPES: {
        watcher: { unlockCycle: 1, category: 'roaming', weight: 1.0, speed: 2.4, gazeFearRate: 7.0, proximityFearRate: 5.0, proximityRadius: 5.0, observationConeDegrees: 60 },
        mimic: { unlockCycle: 1, category: 'mimic', weight: 0.7, revealRadius: 2.2, revealFearSpike: 18.0, revealLinger: 2.5 },
        drifter: { unlockCycle: 2, category: 'roaming', weight: 0.9, patrolSpeed: 2.6, chaseSpeed: 4.6, investigateRadius: 14, proximityRadius: 2.5, proximityFearRate: 6.0 },
        static: { unlockCycle: 2, category: 'roaming', weight: 0.75, speed: 1.4, suppressRadius: 9, vhsRadius: 7, flashlightDrainRate: 4.0, proximityRadius: 6, proximityFearRate: 3.5 },
        hollow_man: { unlockCycle: 4, category: 'roaming', weight: 0.7, speed: 2.8, revealRadius: 12, revealFearRate: 5.0, proximityFearRate: 6.0, proximityRadius: 3.0 },
        grinner: { unlockCycle: 4, category: 'roaming', weight: 0.7, nightOnly: true, speed: 3.2, exposureToRepel: 1.5, exposureIncrementPerEncounter: 0.5, fearRate: 6.0, proximityRadius: 4.0 },
        surveyor: { unlockCycle: 6, category: 'roaming', weight: 0.55, speed: 2.8, investigateRadius: 16, proximityFearRate: 5.0, proximityRadius: 2.5 },
        crawling_mass: { unlockCycle: 6, category: 'environmental', weight: 0.5, spreadInterval: 90, maxCellFraction: 0.15, fearRate: 4.0, cellRadius: 1.5 },
        echo: { unlockCycle: 8, category: 'roaming', weight: 0.4, speed: 3.0, profileWindow: 300, interceptRadius: 2.0, fearRate: 6.0 },
        threshold: { unlockCycle: 10, category: 'event', weight: 0.2, minDuration: 20, maxDuration: 35, sightFearRate: 12.0, suppressRadius: 40 },
      },
    },
    // Cycle-driven item spawn scarcity multiplier (higher = rarer drops). Cycle 1 is the
    // starting cycle; each subsequent cycle (incremented on DAWN) tightens supply.
    scarcityMultiplier(cycleNumber) {
      const table = {
        1: 1.00, 2: 0.95, 3: 0.90, 4: 0.82, 5: 0.74,
        6: 0.66, 7: 0.58, 8: 0.50, 9: 0.43, 10: 0.36
      };
      if (table[cycleNumber] !== undefined) return table[cycleNumber];
      if (cycleNumber < 1) return table[1];
      // Cycle 11+: continue declining ~0.06/cycle from the cycle-10 baseline, floored at 0.10
      const extraCycles = cycleNumber - 10;
      return Math.max(0.10, 0.36 - extraCycles * 0.06);
    }
  },

  // Tension States (sound_design.md)
  TENSION_STATES: {
    STATE_0_SAFE: 0,
    STATE_1_UNEASY: 1,
    STATE_2_OBSERVED: 2,
    STATE_3_DANGER: 3,
    STATE_4_CHASE: 4,
    STATE_5_AFTERMATH: 5,
  },
  
  // Narrative Story Transcripts and Research Notes
  NARRATIVE: {
    OPENING_BRIEFING: {
      title: "EXPEDITION BRIEFING — DTE-04",
      author: "SUPERVISOR K. VAUGHN (DEPT OF SPATIAL ANOMALY)",
      date: "AUGUST 14, 1984 — 08:30 EST",
      body: `BACKUP SCIENTIST DISPATCH ORDER:
      
Target Environment: Nonlocal Interior Space ("Dimensional Test Environment 04" / informally "The Backrooms").
Primary Objective: Locate Primary Exploration Team (Dr. Mercer, Dr. Reed, Dr. Park, D. Cole).
Status: Lost contact at T+47 minutes. Tether telemetry unconfirmed.

Equipment Assigned:
- High-tensile steel-reinforced tether rope (Anchored at Facility Gateway).
- Analog Field Audio Recorder & Cassette Deck.
- Standard Flashlight + 3 Alkaline Batteries.
- Mechanical Compass.

PROCEDURAL RULE: Do not detach from the guide rope. Follow the tether inward, recover team logs, and return immediately.`
    },
    
    MERCER_LOG_01: {
      id: "mercer_01",
      title: "EXPEDITION LOG 01",
      speaker: "Dr. Evelyn Mercer",
      role: "Lead Expedition Physicist",
      audioFile: "./assets/audio/log1dialogue.mp3",
      audioTranscript: `Entry time: 09:42.
The environment remains stable.
Temperature is approximately twenty-one degrees Celsius.
Humidity is unusually high.
We have traveled approximately four hundred meters from the entrance.
Visual landmarks remain repetitive, but the tether continues to provide a reliable path back.
Reed believes the internal dimensions of the structure exceed the physical volume recorded by the external sensors.
We will continue another two hundred meters before returning.`,
      text: `[FIELD LOG 01 — RECORDED ON CASSETTE TAPE]
Found on folding table at Checkpoint Alpha.
Everything looks organized. They had no idea the entrance was closing.`
    },
    
    SAMUEL_REED_NOTES: {
      id: "reed_notes",
      title: "SPATIAL ANOMALY NOTEBOOK",
      speaker: "Dr. Samuel Reed",
      role: "Spatial Physicist",
      body: `Something is wrong with the measurements.
I marked the eastern wall twenty minutes ago.
We walked north.
We turned left three times.
We found the same mark.

That should be mathematically impossible.
Mercer says I made two marks by accident.
I didn't.

The magnetic compass is aligning with the nearest fluorescent ballasts instead of Earth's geomagnetic field. Space is folding in on itself.`
    },
    
    DANIEL_COLE_TAPE: {
      id: "cole_tape",
      title: "AUDIO LOG: TAPE REEL #2",
      speaker: "Daniel Cole",
      role: "Tether & Comms Engineer",
      audioFile: "./assets/audio/log2dialogue.mp3",
      audioTranscript: `[Heavy static]
There's someone walking behind us.
Mercer says it's the echo.
Carpet doesn't echo.
I stopped walking.
It kept going.
[Loud metallic shudder in background]
I'm not looking back again.`,
      text: `Found beside a broken frequency analyzer. Daniel's handwriting on the label is shaking.`
    },
    
    HELEN_PARK_NOTES: {
      id: "park_notes",
      title: "BIOLOGICAL FIELD NOTES",
      speaker: "Dr. Helen Park",
      role: "Biologist & Medical Specialist",
      body: `SAMPLE REPORT:
The moist residue extracted from the carpet padding is not groundwater or plumbing runoff.
It contains organic cellular structures similar to decaying cellulose and synthetic keratin.
The wallpaper adhesive appears to be secreting moisture under thermal stimulation from the ceiling lamps.
This entire place is not inert construction material. It's metabolized.`
    },
    
    OBSERVATION_WARNING: {
      id: "wall_warning",
      title: "OBSERVATION ROOM MARKINGS",
      author: "UNKNOWN RESEARCHER",
      body: `Dozens of arrows are scratched aggressively into the yellow wallpaper pointing in conflicting directions.
Scrawled in red grease pencil:
"DO NOT TRUST THE HALLWAYS. IT LEARNS WHERE YOU ARE TRYING TO GO."`
    },

    LAB_SUBSTANCE_29_NOTE: {
      id: "lab_substance_29_note",
      title: "LAB NOTES — MAY 7TH 1981",
      author: "UNKNOWN AUTHOR",
      role: "UNIDENTIFIED SUBSTANCE #29",
      body: `“We extracted this substance from one of the expeditions, we have not identified the material and atomic structure, we have deemed it dangrous and put it inside a containment tube”`
    },

    VAUGHN_RESIGNATION_LETTER: {
      id: "vaughn_resignation",
      title: "OFFICIAL NOTICE OF RESIGNATION",
      speaker: "Supervisor Kenneth Vaughn",
      role: "Operations Supervisor // Dept. of Spatial Anomaly",
      body: `DEPARTMENT OF SPATIAL ANOMALY
UNITED STATES OF AMERICA — CLASSIFIED OPERATION DTE-04

FROM: Kenneth Vaughn, Operations Supervisor
TO: Bureau Directorate & Project Oversight
DATE: October 14, 1982
SUBJECT: Official Resignation & Protocol Termination

I, Kenneth Vaughn, hereby submit my formal resignation from the Department of Spatial Anomaly, effective immediately.

Due to the catastrophic turn of events and the sudden severance of the primary lifeline tether, I can no longer oversee this operation in good conscience.

I have left the incoming rescue operation scientist a pre-recorded dispatch on the gateway frequency outlining their initial directive. However, let the record reflect that I hold no realistic hope for their survival, nor the return of the original research expedition.

The anomaly is expanding inward. I am vacating the staging facility before the perimeter seals fail.`
    },
    
    MERCER_FINAL_TAPE: {
      id: "mercer_final",
      title: "FINAL EXPEDITION LOG",
      speaker: "Dr. Evelyn Mercer",
      role: "Expedition Leader",
      audioFile: "./assets/audio/final_log_tape.mp3",
      audioTranscript: `We lost the entrance.
Cole checked the tether.
It wasn't broken.
It simply ended.
Reed says the rooms are reorganizing around us.
Helen thinks something is reacting to our movement.
We have decided to establish another camp and wait for rescue.
If another team finds this recording...
do not follow our markers.
Something else has started using them.
[A distant, identical voice calls: "Evelyn..."]
...That isn't me.`,
      text: `Recovered from the destroyed camp behind the heavy maintenance door. Bloodstains on the tape case.`
    },

    GARAGE_MERCER_LOG: {
      id: "garage_mercer_tape",
      title: "EXPEDITION LOG: SUBTERRANEAN GARAGE",
      speaker: "Dr. Evelyn Mercer",
      role: "Expedition Leader",
      audioFile: "./assets/audio/garage_cassette%231.mp3",
      audioTranscript: `We appear to be inside some kind of parking garage.
The cars have no plates on them, and we can’t seem to find an exit.
All the cars are locked and we can’t get in.
The others have ventured further to find a gas can.
We'll try to jimmy the lock.`,
      text: `Left on the hood of an abandoned burgundy sedan near the garage entrance. Tape labeled 'SUB-LEVEL 02'.`
    },

    HIGHWAY_POLICE_LOG: {
      id: "police_radio_tape",
      title: "HIGHWAY PATROL DISPATCH (UNIT 412)",
      speaker: "Officer J. Alvarez",
      role: "State Highway Patrol",
      audioFile: "./assets/audio/garage_cassette%231.mp3",
      audioTranscript: `Dispatch, Unit 412. I've been driving north on Route 9 for four hours straight.
Mile markers keep repeating. The odometer is spinning forward but the road never bends.
There are abandoned cars every half mile.
No other traffic. Just dark trees and headlights.
If anyone hears this... do not pull over into the fog.`,
      text: `Recovered from the passenger seat of an abandoned State Highway Patrol cruiser on the highway shoulder.`
    },

    HIGHWAY_REED_STORE_LOG: {
      id: "highway_reed_store_tape",
      title: "TIME UNKNOWN — DATE UNKNOWN",
      speaker: "Dr. Samuel Reed",
      role: "Spatial Physicist",
      audioFile: "./assets/audio/convenienceStoretape.mp3",
      degradedTape: true,
      audioTranscript: `Time unknown.
Date unknown.

We've been exploring this mysterious highway for miles. When we discovered this convenience store, we thought we found food, but we didn't. It's completely empty.

We are running low on food and water. There's not much we can do but keep moving forward.

The gas pump doesn't work at the gas station.`,
      text: `Recovered from the middle of the empty roadside convenience store.`
    }
  }
};
