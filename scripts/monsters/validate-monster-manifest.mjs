#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSET_ROOT = path.join(ROOT, 'assets', 'survival', 'monsters');
const ATTRIBUTION = fs.readFileSync(path.join(ROOT, 'docs', 'THIRD_PARTY_ASSETS.md'), 'utf8');
const EXPECTED = [
  'watcher', 'mimic', 'drifter', 'hollow_man', 'static',
  'grinner', 'surveyor', 'crawling_mass', 'echo', 'threshold',
];

function triangleCount(document) {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const accessor = primitive.getIndices() || primitive.getAttribute('POSITION');
      if (accessor) total += Math.floor(accessor.getCount() / 3);
    }
  }
  return total;
}

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const failures = [];
  console.log('validate-monster-manifest: validating 10 runtime assets\n');

  for (const id of EXPECTED) {
    const dir = path.join(ASSET_ROOT, id);
    const manifestFile = path.join(dir, 'runtime-manifest.json');
    const metadataFile = path.join(dir, 'metadata.md');
    const licenseFile = path.join(dir, 'source', 'license.txt');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      const license = fs.readFileSync(licenseFile, 'utf8');
      if (!fs.existsSync(metadataFile)) throw new Error('metadata.md missing');
      if (manifest.id !== id || manifest.schemaVersion !== 1) throw new Error('invalid id or schemaVersion');
      if (manifest.source.license !== 'CC-BY-4.0' || !license.includes('CC-BY-4.0')) {
        throw new Error('license is not verified CC-BY-4.0');
      }
      if (!ATTRIBUTION.includes(manifest.source.url)) throw new Error('attribution URL missing from THIRD_PARTY_ASSETS.md');
      const modelFile = path.join(dir, manifest.model.file);
      if (!fs.existsSync(modelFile)) throw new Error(`processed model missing: ${manifest.model.file}`);
      const document = await io.read(modelFile);
      const actualTriangles = triangleCount(document);
      if (actualTriangles !== manifest.model.triangleCount) throw new Error('manifest triangle count does not match model');
      if (actualTriangles >= 50000) throw new Error(`triangle budget exceeded: ${actualTriangles}`);
      const bounds = manifest.model.bounds;
      if (!bounds || !Array.isArray(bounds.min) || !Array.isArray(bounds.max)) throw new Error('model bounds missing');
      if (!Number.isFinite(manifest.model.targetHeight) || manifest.model.targetHeight <= 0) throw new Error('targetHeight invalid');
      if (!Array.isArray(manifest.textures)) throw new Error('textures must be an array');
      const textureLimit = id === 'threshold' && manifest.textureExceptionReason ? 2048 : 1024;
      for (const texture of manifest.textures) {
        if (!Number.isInteger(texture.maxDimension) || texture.maxDimension <= 0 || texture.maxDimension > textureLimit) {
          throw new Error(`texture budget invalid: ${texture.maxDimension}`);
        }
      }
      if (!Array.isArray(manifest.clips) || manifest.clips.length === 0) throw new Error('clip map missing');
      if (manifest.clips.some((clip) => clip.proceduralFallback !== true)) throw new Error('clip lacks procedural fallback');
      console.log(`  PASS  ${id.padEnd(14)} ${String(actualTriangles).padStart(6)} triangles`);
    } catch (error) {
      failures.push(`${id}: ${error.message}`);
      console.log(`  FAIL  ${id}: ${error.message}`);
    }
  }

  if (failures.length) {
    console.log(`\nvalidate-monster-manifest: ${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log('\nvalidate-monster-manifest: all 10 assets passed');
}

main().catch((error) => {
  console.error(`validate-monster-manifest: ${error.stack || error.message}`);
  process.exit(2);
});
