#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSET_ROOT = path.join(ROOT, 'assets', 'survival', 'monsters');
const CLI = path.join(ROOT, 'node_modules', '.bin', 'gltf-transform');
const ARGS = process.argv.slice(2);
const MANIFEST_ONLY = ARGS.includes('--manifest-only');
const ONLY = new Set(ARGS.filter((arg) => !arg.startsWith('--')));

const ROSTER = [
  {
    id: 'watcher', name: 'Horror Humanoid Creature', creator: 'PurplePoint',
    sourceId: 'b5874b20f8c34b919a52eb3cb7dad94c', sourceTriangles: 95786,
    url: 'https://sketchfab.com/3d-models/horror-humanoid-creature-b5874b20f8c34b919a52eb3cb7dad94c',
    targetHeight: 2.7, ratio: 0.25, clips: ['idle', 'walk', 'reach'],
  },
  {
    id: 'mimic', name: 'Mimic', creator: 'Corey Keeling',
    sourceId: 'daec1bc608d640598b94700067382ecd', sourceTriangles: 93036,
    url: 'https://sketchfab.com/3d-models/mimic-daec1bc608d640598b94700067382ecd',
    targetHeight: 0.9, ratio: 0.25, clips: ['disguise', 'reveal', 'bite', 'idle'],
  },
  {
    id: 'drifter', name: 'Cave monster', creator: 'Bullcet',
    sourceId: '4d78d918f0054e95b4cf8f1cbc7855f1', sourceTriangles: 10056,
    url: 'https://sketchfab.com/3d-models/cave-monster-4d78d918f0054e95b4cf8f1cbc7855f1',
    targetHeight: 1.85, ratio: 1, clips: ['Standing', 'walk', 'run', 'listen', 'search'],
  },
  {
    id: 'hollow_man', name: 'Hazmat Character Model', creator: 'adambilyea',
    sourceId: 'f331549106d84a3380fb31111299161e', sourceTriangles: 9344,
    url: 'https://sketchfab.com/3d-models/hazmat-character-model-f331549106d84a3380fb31111299161e',
    targetHeight: 1.82, ratio: 1, clips: ['idle', 'walk', 'run', 'reveal', 'attack'],
  },
  {
    id: 'static', name: 'Creeping Shadow Creature - Free Horror 3D Model', creator: 'PurplePoint',
    sourceId: '53e77576ca0b4c5988ba2991a4bff075', sourceTriangles: 99197,
    url: 'https://sketchfab.com/3d-models/creeping-shadow-creature-free-horror-3d-model-53e77576ca0b4c5988ba2991a4bff075',
    targetHeight: 2.1, ratio: 0.24, clips: ['idle', 'walk', 'twitch'],
  },
  {
    id: 'grinner', name: 'The smile (Rigged)', creator: 'Vertex Mercher',
    sourceId: '6795ba0b406f4e61993fafebbb94ebd9', sourceTriangles: 164736,
    url: 'https://sketchfab.com/3d-models/the-smile-rigged-6795ba0b406f4e61993fafebbb94ebd9',
    targetHeight: 1.95, ratio: 0.14, clips: ['idle', 'approach', 'attack', 'recoil'],
  },
  {
    id: 'surveyor', name: 'The Fifth Knight - Gas Mask Character', creator: 'leunamanuelgc',
    sourceId: 'b3011820639340c5812cdae329bc7a8f', sourceTriangles: 16572,
    url: 'https://sketchfab.com/3d-models/the-fifth-knight-gas-mask-character-b3011820639340c5812cdae329bc7a8f',
    targetHeight: 1.82, ratio: 1, clips: ['idle', 'walk', 'run', 'inspect', 'search', 'attack'],
  },
  {
    id: 'crawling_mass', name: 'The Flesh', creator: 'CameronProteau',
    sourceId: '47fb5fb4ea0640819e5a2b1a5696a120', sourceTriangles: 9663,
    url: 'https://sketchfab.com/3d-models/the-flesh-47fb5fb4ea0640819e5a2b1a5696a120',
    targetHeight: 0.65, ratio: 1, clips: ['idle', 'spread'],
  },
  {
    id: 'echo', name: 'Void Stalker', creator: 'SkellyCooks',
    sourceId: '0758ec59a17144248f43a7ac6fcab559', sourceTriangles: 20266,
    url: 'https://sketchfab.com/3d-models/void-stalker-0758ec59a17144248f43a7ac6fcab559',
    targetHeight: 2.2, ratio: 1, clips: ['idle', 'walk', 'run', 'attack', 'crouch', 'inspect', 'peek'],
  },
  {
    id: 'threshold', name: 'Crimson Eyehand Abomination', creator: 'PurplePoint',
    sourceId: 'c27de05f75094cd681525a048613ba78', sourceTriangles: 39924,
    url: 'https://sketchfab.com/3d-models/crimson-eyehand-abomination-c27de05f75094cd681525a048613ba78',
    targetHeight: 4.2, ratio: 1, clips: ['idle', 'deform', 'reach'],
  },
];

function runCli(args) {
  const result = spawnSync(CLI, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join('\n'));
  }
  return result.stdout.trim();
}

function imageDimensions(bytes, mimeType) {
  const b = Buffer.from(bytes || []);
  if (mimeType === 'image/png' && b.length >= 24) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < b.length) {
      if (b[offset] !== 0xff) { offset++; continue; }
      const marker = b[offset + 1];
      const length = b.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: b.readUInt16BE(offset + 7), height: b.readUInt16BE(offset + 5) };
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return { width: 0, height: 0 };
}

async function inspectModel(file) {
  const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
  const root = document.getRoot();
  let triangleCount = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const accessor = primitive.getIndices() || primitive.getAttribute('POSITION');
      if (accessor) triangleCount += Math.floor(accessor.getCount() / 3);
    }
  }
  const textures = root.listTextures().map((texture, index) => {
    const mimeType = texture.getMimeType() || 'application/octet-stream';
    const { width, height } = imageDimensions(texture.getImage(), mimeType);
    return {
      file: `processed/model.glb#texture-${index}`,
      mimeType,
      width,
      height,
      maxDimension: Math.max(width, height),
    };
  });
  const scene = root.getDefaultScene() || root.listScenes()[0];
  const bounds = scene ? getBounds(scene) : { min: [0, 0, 0], max: [0, 0, 0] };
  return {
    triangleCount,
    animations: root.listAnimations().map((animation) => animation.getName() || 'unnamed'),
    textures,
    bounds,
  };
}

async function buildMonster(entry) {
  const dir = path.join(ASSET_ROOT, entry.id);
  const source = path.join(dir, 'source', 'scene.gltf');
  const license = path.join(dir, 'source', 'license.txt');
  const processedDir = path.join(dir, 'processed');
  const output = path.join(processedDir, 'model.glb');

  if (!fs.existsSync(source) || !fs.existsSync(license)) {
    throw new Error(`${entry.id}: source model or license is missing`);
  }
  const licenseText = fs.readFileSync(license, 'utf8');
  if (!licenseText.includes('CC-BY-4.0') || !licenseText.includes('Commercial use is allowed')) {
    throw new Error(`${entry.id}: source license is not approved CC BY 4.0`);
  }

  fs.mkdirSync(processedDir, { recursive: true });
  if (!MANIFEST_ONLY) {
    const args = [
      'optimize', source, output,
      '--compress', 'false',
      '--texture-compress', 'auto',
      '--texture-size', entry.id === 'threshold' ? '2048' : '1024',
      '--flatten', 'false', '--join', 'false', '--instance', 'false', '--palette', 'false',
      '--simplify', entry.ratio < 1 ? 'true' : 'false',
    ];
    if (entry.ratio < 1) {
      args.push('--simplify-ratio', String(entry.ratio), '--simplify-error', '1');
    }
    runCli(args);
  } else if (!fs.existsSync(output)) {
    throw new Error(`${entry.id}: processed model missing for --manifest-only`);
  }

  const stats = await inspectModel(output);
  const proceduralClips = entry.clips.map((name) => ({
    name,
    embedded: stats.animations.includes(name),
    proceduralFallback: true,
  }));
  const manifest = {
    schemaVersion: 1,
    id: entry.id,
    source: {
      name: entry.name,
      modelId: entry.sourceId,
      creator: entry.creator,
      url: entry.url,
      license: 'CC-BY-4.0',
      attributionRequired: true,
      retrievedAt: '2026-08-16',
      originalTriangleCount: entry.sourceTriangles,
    },
    model: {
      file: 'processed/model.glb',
      triangleCount: stats.triangleCount,
      bounds: stats.bounds,
      targetHeight: entry.targetHeight,
      forwardAxis: '-Z',
      groundAtY: 0,
    },
    textures: stats.textures,
    clips: proceduralClips,
    embeddedAnimations: stats.animations,
    runtime: {
      materialMode: entry.id === 'static' ? 'shadow' : 'retro-pbr',
      castShadow: false,
      receiveShadow: false,
    },
  };
  if (entry.id === 'threshold') {
    manifest.textureExceptionReason = 'Threshold may retain up to 2048px textures for close-range distortion.';
  }
  fs.writeFileSync(path.join(dir, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`  BUILT  ${entry.id.padEnd(14)} ${String(stats.triangleCount).padStart(6)} triangles  ${stats.textures.length} texture(s)`);
}

async function main() {
  if (!fs.existsSync(CLI)) throw new Error('Missing @gltf-transform/cli. Run npm install first.');
  const selected = ONLY.size ? ROSTER.filter((entry) => ONLY.has(entry.id)) : ROSTER;
  if (!selected.length) throw new Error(`No roster entries matched: ${[...ONLY].join(', ')}`);
  console.log(`build-monster-assets: ${MANIFEST_ONLY ? 'refreshing manifests for' : 'processing'} ${selected.length} source model(s)\n`);
  for (const entry of selected) await buildMonster(entry);
  console.log('\nbuild-monster-assets: complete');
}

main().catch((error) => {
  console.error(`build-monster-assets: ${error.message}`);
  process.exit(1);
});
