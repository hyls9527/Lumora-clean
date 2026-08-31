/**
 * Lumora Performance Budget
 * Run: node scripts/perf-budget.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BUDGETS = {
  // 0.5 MiB. 2026-09-01: splash icon compressed 452KB → 21KB (256px quantized;
  // rendered at 80px in SplashScreen) to stay honest under this budget.
  'Frontend bundle (dist/)': { max: 524_288, unit: 'bytes' },
  'Rust binary (release)': { max: 30_000_000, unit: 'bytes' },
  // Playwright E2E deps (68573c4) pushed the lockfile past 350; budget keeps
  // a little headroom for tooling-only additions.
  'npm packages': { max: 360, unit: 'count' },
  'cargo crates': { max: 700, unit: 'count' },
  // 2026-09-01: v0.10.x added updater store + regression tests; growth is legit.
  'TypeScript files': { max: 220, unit: 'count' },
  'Zustand stores': { max: 14, unit: 'count' },
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
const npmCount = (readFileSync('package-lock.json', 'utf8').match(/"resolved":/g) || []).length;
results.push({ name: 'npm packages', value: npmCount, budget: BUDGETS['npm packages'].max, ok: npmCount <= BUDGETS['npm packages'].max });

// cargo crates
const cargoCount = (readFileSync('src-tauri/Cargo.lock', 'utf8').match(/\[\[package\]\]/g) || []).length;
results.push({ name: 'cargo crates', value: cargoCount, budget: BUDGETS['cargo crates'].max, ok: cargoCount <= BUDGETS['cargo crates'].max });

// TypeScript files
const tsCount = countLines('src', '.ts') + countLines('src', '.tsx');
results.push({ name: 'TypeScript files', value: tsCount, budget: BUDGETS['TypeScript files'].max, ok: tsCount <= BUDGETS['TypeScript files'].max });

// Zustand stores
const storeCount = (() => {
  try { return readdirSync('src/stores').filter((f) => f.endsWith('.ts')).length; } catch { return 0; }
})();
results.push({ name: 'Zustand stores', value: storeCount, budget: BUDGETS['Zustand stores'].max, ok: storeCount <= BUDGETS['Zustand stores'].max });

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
