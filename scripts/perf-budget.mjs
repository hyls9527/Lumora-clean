/**
 * Lumora Performance Budget
 * Run: node scripts/perf-budget.mjs
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const BUDGETS = {
  'Frontend bundle (dist/)': { max: 500_000, unit: 'bytes' },
  'Rust binary (release)': { max: 30_000_000, unit: 'bytes' },
  'npm packages': { max: 300, unit: 'count' },
  'cargo crates': { max: 700, unit: 'count' },
  'TypeScript files': { max: 200, unit: 'count' },
};

function dirSize(path) {
  let total = 0;
  try {
    for (const f of readdirSync(path)) {
      const s = statSync(join(path, f));
      total += s.isDirectory() ? dirSize(join(path, f)) : s.size;
    }
  } catch { /* dir missing */ }
  return total;
}

function countLines(path, ext) {
  let count = 0;
  try {
    for (const f of readdirSync(path, { recursive: true })) {
      if (f.endsWith(ext)) count++;
    }
  } catch { /* dir missing */ }
  return count;
}

const results = [];
let passed = true;

// Frontend bundle
const distSize = dirSize('dist');
results.push({ name: 'Frontend bundle (dist/)', value: distSize, budget: BUDGETS['Frontend bundle (dist/)'].max, ok: distSize <= BUDGETS['Frontend bundle (dist/)'].max });

// Rust binary
try {
  const binStat = statSync('src-tauri/target/release/Lumora.exe');
  results.push({ name: 'Rust binary (release)', value: binStat.size, budget: BUDGETS['Rust binary (release)'].max, ok: binStat.size <= BUDGETS['Rust binary (release)'].max });
} catch {
  results.push({ name: 'Rust binary (release)', value: 'not built', budget: '30MB', ok: true });
}

// npm packages
const npmCount = (execSync('cat package-lock.json | grep -c \'"resolved":\'', { encoding: 'utf8' }).trim() | 0);
results.push({ name: 'npm packages', value: npmCount, budget: BUDGETS['npm packages'].max, ok: npmCount <= BUDGETS['npm packages'].max });

// cargo crates
const cargoCount = (execSync('grep -c "\\[\\[package\\]\\]" src-tauri/Cargo.lock', { encoding: 'utf8' }).trim() | 0);
results.push({ name: 'cargo crates', value: cargoCount, budget: BUDGETS['cargo crates'].max, ok: cargoCount <= BUDGETS['cargo crates'].max });

// TypeScript files
const tsCount = countLines('src', '.ts') + countLines('src', '.tsx');
results.push({ name: 'TypeScript files', value: tsCount, budget: BUDGETS['TypeScript files'].max, ok: tsCount <= BUDGETS['TypeScript files'].max });

// Report
console.log('\n=== Lumora Performance Budget ===\n');
for (const r of results) {
  const icon = r.ok ? '✅' : '❌';
  const val = typeof r.value === 'number' ? (r.value > 10000 ? `${(r.value / 1024 / 1024).toFixed(1)}MB` : r.value.toLocaleString()) : r.value;
  const bud = typeof r.budget === 'number' ? (r.budget > 10000 ? `${(r.budget / 1024 / 1024).toFixed(1)}MB` : r.budget.toLocaleString()) : r.budget;
  console.log(`${icon} ${r.name}: ${val} / ${bud}`);
  if (!r.ok) passed = false;
}

console.log(passed ? '\n✅ All budgets met.' : '\n❌ Budget exceeded!');
process.exit(passed ? 0 : 1);
