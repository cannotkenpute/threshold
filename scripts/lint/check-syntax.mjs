#!/usr/bin/env node
/**
 * THRESHOLD syntax checker (pure Node, zero dependencies).
 *
 * Walks js/, scripts/, api/, server/ plus server.js and syntax-checks every
 * .js/.mjs file with `node --check`. Each file is checked as an ES module by
 * copying it to a temporary .mjs file — .mjs is unambiguously ESM regardless
 * of any package.json, and every syntactically-valid CommonJS file is also
 * syntactically-valid ESM (require/module.exports are plain identifiers), so
 * this is safe for mixed trees.
 *
 * Excluded: Assets/, graphify-out/, .commandcode/, .deepcode/, node_modules,
 * dotfiles (never walked), and any minified vendor bundles.
 *
 * Exit code: 0 = all pass, 1 = one or more failures/errors.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'threshold-lint-'));

const ROOT_DIRS = ['js', 'scripts', 'api', 'server'];
const ROOT_FILES = ['server.js'];
const EXCLUDED_DIRS = new Set([
  'Assets',
  'graphify-out',
  '.commandcode',
  '.deepcode',
  'node_modules',
]);

function collectFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.js' || ext === '.mjs') out.push(full);
    }
  }
}

function checkFile(file) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { ok: false, error: `unreadable: ${err.message}` };
  }
  const tmp = path.join(TMP_DIR, `check-${Math.random().toString(36).slice(2)}.mjs`);
  try {
    fs.writeFileSync(tmp, source);
    const res = spawnSync(process.execPath, ['--check', tmp], {
      encoding: 'utf8',
      timeout: 30000,
    });
    if (res.error) return { ok: false, error: `spawn failed: ${res.error.message}` };
    if (res.status !== 0) {
      const detail = (res.stderr || '').split('\n').filter(Boolean).slice(0, 6).join('\n');
      return { ok: false, error: detail || `node --check exited ${res.status}` };
    }
    return { ok: true };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
}

function main() {
  const files = [];
  for (const dir of ROOT_DIRS) collectFiles(path.join(ROOT, dir), files);
  for (const rel of ROOT_FILES) {
    const full = path.join(ROOT, rel);
    if (fs.existsSync(full)) files.push(full);
  }
  files.sort();

  let failures = 0;
  console.log(`check-syntax: checking ${files.length} file(s) as ES modules\n`);
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const result = checkFile(file);
    if (result.ok) {
      console.log(`  PASS  ${rel}`);
    } else {
      failures++;
      console.log(`  FAIL  ${rel}`);
      console.log(`        ${result.error.replace(/\n/g, '\n        ')}`);
    }
  }

  try {
    fs.rmdirSync(TMP_DIR);
  } catch {}

  if (failures > 0) {
    console.log(`\ncheck-syntax: ${failures} file(s) FAILED out of ${files.length}`);
    process.exit(1);
  }
  console.log(`\ncheck-syntax: all ${files.length} file(s) passed`);
}

main();
