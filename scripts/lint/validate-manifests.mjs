#!/usr/bin/env node
/**
 * THRESHOLD asset-manifest + protocol-constant validator (pure Node, zero deps).
 *
 * 1. Walks Assets/survival/monsters/<dir>/runtime-manifest.json. If none exist yet
 *    (assets not processed), this stage is skipped gracefully with a notice.
 *    Expected manifest shape (see SURVIVAL_MONSTERS_IMPLEMENTATION_PLAN.md):
 *    {
 *      "id": "crawling_mass",                    // required, non-empty string
 *      "source": {                                // required attribution
 *        "name": "...", "creator": "...", "url": "...",
 *        "license": "...", "attributionRequired": true
 *      },
 *      "model": { "file": "source/scene.gltf", "triangleCount": 9663 }, // < 50000
 *      "textures": [ { "file": "...", "maxDimension": 1024 } ],          // <= 1024
 *      "clips": [ { "name": "idle", "procedural": true } ]  // every clip must
 *                                                          // declare a
 *                                                          // procedural fallback
 *    }
 *    Texture exception: a manifest may declare "textureExceptionReason" to use
 *    2048px max (reserved for the Threshold monster per the plan); anything
 *    larger is always a violation.
 *
 * 2. Validates js/multiplayer/protocol.js constants are sane by importing the
 *    module (PROTOCOL_VERSION integer >= 1, positive rates, bounded windows).
 *
 * Exit code: 0 = valid, 1 = violations, 2 = structural error.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MONSTERS_DIR = path.join(ROOT, 'Assets', 'survival', 'monsters');
const PROTOCOL_FILE = path.join(ROOT, 'js', 'multiplayer', 'protocol.js');

const MAX_TRIANGLES = 50000;
const MAX_TEXTURE_DIMENSION = 1024;
const MAX_TEXTURE_DIMENSION_WITH_EXCEPTION = 2048;

const violations = [];
const warnings = [];

function violation(where, msg) {
  violations.push(`[${where}] ${msg}`);
}

function asInt(value) {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function validateManifest(dirName, manifestPath) {
  const where = `manifest:${dirName}`;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    violation(where, `not valid JSON: ${err.message}`);
    return;
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    violation(where, 'root must be a JSON object');
    return;
  }

  if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
    violation(where, 'missing required string field "id" (monster id)');
  } else if (manifest.id !== dirName) {
    warnings.push(`[${where}] id "${manifest.id}" does not match directory "${dirName}"`);
  }

  const src = manifest.source;
  if (!src || typeof src !== 'object') {
    violation(where, 'missing required "source" attribution object');
  } else {
    for (const field of ['name', 'creator', 'url', 'license']) {
      if (typeof src[field] !== 'string' || !src[field].trim()) {
        violation(where, `missing source attribution field "${field}"`);
      }
    }
    if (src.attributionRequired !== true) {
      warnings.push(`[${where}] source.attributionRequired is not explicitly true`);
    }
  }

  const model = manifest.model;
  if (!model || typeof model !== 'object') {
    violation(where, 'missing required "model" object');
  } else {
    const tri = asInt(model.triangleCount) ?? asInt(model.triangles);
    if (tri === undefined) {
      violation(where, 'missing integer "model.triangleCount"');
    } else if (tri < 0 || tri >= MAX_TRIANGLES) {
      violation(where, `triangle count ${tri} is not under the ${MAX_TRIANGLES} budget`);
    }
    if (typeof model.file !== 'string' || !model.file.trim()) {
      violation(where, 'missing "model.file" path');
    } else if (!fs.existsSync(path.join(path.dirname(manifestPath), model.file))) {
      violation(where, `model file not found on disk: ${model.file}`);
    }
  }

  const textures = manifest.textures;
  if (!Array.isArray(textures) || textures.length === 0) {
    violation(where, 'missing non-empty "textures" array');
  } else {
    const limit = manifest.textureExceptionReason
      ? MAX_TEXTURE_DIMENSION_WITH_EXCEPTION
      : MAX_TEXTURE_DIMENSION;
    if (manifest.textureExceptionReason) {
      warnings.push(`[${where}] texture exception active (<= ${limit}): ${manifest.textureExceptionReason}`);
    }
    for (const [i, tex] of textures.entries()) {
      const dim = asInt(tex.maxDimension) ?? asInt(tex.size) ?? asInt(tex.resolution);
      if (dim === undefined) {
        violation(where, `textures[${i}]: missing integer maxDimension`);
      } else if (dim > limit) {
        violation(where, `textures[${i}]: max dimension ${dim} exceeds limit ${limit}`);
      }
    }
  }

  const clips = manifest.clips;
  if (!Array.isArray(clips) || clips.length === 0) {
    violation(where, 'missing non-empty "clips" array (every clip needs a procedural fallback declaration)');
  } else {
    for (const [i, clip] of clips.entries()) {
      const name = typeof clip.name === 'string' && clip.name.trim() ? clip.name : `clips[${i}]`;
      const hasFallback =
        clip.procedural === true ||
        clip.proceduralFallback === true ||
        clip.fallback === 'procedural' ||
        clip.source === 'procedural';
      if (!hasFallback) {
        violation(where, `clip "${name}": no procedural fallback declared (procedural|proceduralFallback|fallback:"procedural"|source:"procedural")`);
      }
    }
  }
}

async function validateProtocolConstants() {
  const where = 'protocol:js/multiplayer/protocol.js';
  let mod;
  try {
    mod = await import(pathToFileURL(PROTOCOL_FILE).href);
  } catch (err) {
    violation(where, `cannot import module: ${err.message}`);
    return;
  }
  if (!Number.isInteger(mod.PROTOCOL_VERSION) || mod.PROTOCOL_VERSION < 1) {
    violation(where, `PROTOCOL_VERSION must be an integer >= 1 (got ${String(mod.PROTOCOL_VERSION)})`);
  }
  if (typeof mod.GAME_VERSION !== 'string' || !/^\d+\.\d+\.\d+/.test(mod.GAME_VERSION)) {
    violation(where, `GAME_VERSION must be a semver-style string (got ${String(mod.GAME_VERSION)})`);
  }
  const rates = mod.UPDATE_RATES_HZ || {};
  for (const key of ['PLAYER_TRANSFORM', 'MONSTER_SNAPSHOT', 'AUTHORITY_HEARTBEAT', 'SNAPSHOT_CACHE']) {
    if (typeof rates[key] !== 'number' || !(rates[key] > 0)) {
      violation(where, `UPDATE_RATES_HZ.${key} must be a positive number`);
    }
  }
  const interp = mod.INTERPOLATION || {};
  if (typeof interp.BUFFER_MS !== 'number' || !(interp.BUFFER_MS > 0)) {
    violation(where, 'INTERPOLATION.BUFFER_MS must be a positive number');
  }
  if (typeof interp.MAX_EXTRAPOLATION_MS !== 'number' || !(interp.MAX_EXTRAPOLATION_MS > 0)) {
    violation(where, 'INTERPOLATION.MAX_EXTRAPOLATION_MS must be a positive number');
  }
  if (!Number.isInteger(mod.MAX_PLAYERS) || mod.MAX_PLAYERS < 1 || mod.MAX_PLAYERS > 32) {
    violation(where, `MAX_PLAYERS must be an integer 1..32 (got ${String(mod.MAX_PLAYERS)})`);
  }
  if (!Number.isInteger(mod.RECONNECT_WINDOW_MS) || mod.RECONNECT_WINDOW_MS < 1000) {
    violation(where, `RECONNECT_WINDOW_MS must be an integer >= 1000 (got ${String(mod.RECONNECT_WINDOW_MS)})`);
  }
  const critical = new Set(mod.CRITICAL_EVENT_TYPES || []);
  for (const t of mod.REPLACEABLE_STATE_TYPES || []) {
    if (critical.has(t)) violation(where, `"${t}" is listed as BOTH critical and replaceable`);
  }
}

async function main() {
  console.log('validate-manifests: THRESHOLD manifest + protocol constants\n');

  let manifestDirs = [];
  try {
    manifestDirs = fs
      .readdirSync(MONSTERS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    console.log('  NOTICE: Assets/survival/monsters/ does not exist yet — asset stage skipped');
  }

  let checked = 0;
  let skipped = 0;
  for (const dir of manifestDirs) {
    const manifestPath = path.join(MONSTERS_DIR, dir, 'runtime-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      skipped++;
      continue;
    }
    checked++;
    validateManifest(dir, manifestPath);
  }
  if (skipped > 0) {
    console.log(`  NOTICE: ${skipped}/${manifestDirs.length} monster dir(s) have no runtime-manifest.json yet — skipped (write manifests during asset processing)`);
  }
  if (checked === 0 && manifestDirs.length > 0) {
    console.log('  NOTICE: no runtime-manifest.json files found — asset stage skipped gracefully');
  } else if (checked > 0) {
    console.log(`  Checked ${checked} runtime manifest(s)`);
  }
  console.log('');

  await validateProtocolConstants();
  console.log('  Checked js/multiplayer/protocol.js constants');
  console.log('');

  for (const w of warnings) console.log(`  WARN  ${w}`);
  if (violations.length > 0) {
    for (const v of violations) console.log(`  FAIL  ${v}`);
    console.log(`\nvalidate-manifests: ${violations.length} violation(s)`);
    process.exit(1);
  }
  console.log('validate-manifests: OK');
}

main().catch((err) => {
  console.error(`validate-manifests: unexpected error: ${err && err.stack ? err.stack : err}`);
  process.exit(2);
});
