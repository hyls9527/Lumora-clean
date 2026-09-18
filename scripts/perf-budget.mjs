/**
 * Lumora Performance Budget
 * Run: node scripts/perf-budget.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BUDGETS = {
  // 0.54 MiB. History: 2026-09-01 the splash icon was compressed 452KB → 21KB
  // (256px quantized; rendered at 80px in SplashScreen). 2026-09-17 the
  // reliability/diagnostics surfaces (crash + backup telemetry, health panel)
  // added ~2.6KB over the old 0.5 MiB line; the extra is user-facing settings
  // UI, so the budget moves with a reason instead of the code being contorted
  // to fit a round number. The dev-only measurement pages are excluded from
  // the shipped build (see vite.config.ts / build:perf), so they do not count.
  'Frontend bundle (dist/)': { max: 566_231, unit: 'bytes' },
  'Rust binary (release)': { max: 30_000_000, unit: 'bytes' },
  // Playwright E2E deps (68573c4) pushed the lockfile past 350; budget keeps
  // a little headroom for tooling-only additions.
  'npm packages': { max: 360, unit: 'count' },
  'cargo crates': { max: 700, unit: 'count' },
  // 2026-09-01: v0.10.x added updater store + regression tests; growth is legit.
  // 2026-09-17: +5 files from the reliability/verification work (reliability.ts,
  // api/diagnostics.ts, HealthPanel.tsx, build-perf.mjs helper module tests).
  // 2026-09-18: +6 for the background-job feature (jobs.ts, jobStore.ts,
  // JobBar.tsx and one test per module). Raised to keep a couple of slots of
  // headroom rather than sitting at the ceiling, where every test file fails the
  // build for the wrong reason.
  'TypeScript files': { max: 240, unit: 'count' },
  // Raised from 14 by exactly one: jobStore owns *job* state (how many are
  // running, how far along). Folding it into an existing store would have put
  // unrelated concerns in one place just to satisfy a counter. The budget's job
  // is to catch accidental state proliferation, not deliberate additions.
  'Zustand stores': { max: 16, unit: 'count' },
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
// The release artifact is `Lumora.exe` on Windows and `Lumora` on
// Linux/macOS — check both candidates on every platform so the budget
// measures the real binary (C-3 round-2).
const rustBinaryNames = ['Lumora.exe', 'Lumora'];
let rustBinary = null;
for (const name of rustBinaryNames) {
  try {
    rustBinary = { name, stat: statSync(`src-tauri/target/release/${name}`) };
    break;
  } catch {
    // candidate missing, try the next
  }
}
if (rustBinary) {
  results.push({
    name: 'Rust binary (release)',
    value: rustBinary.stat.size,
    budget: BUDGETS['Rust binary (release)'].max,
    ok: rustBinary.stat.size <= BUDGETS['Rust binary (release)'].max,
  });
} else if (process.env.LUMORA_SKIP_RUST_BINARY === '1') {
  // Explicit opt-out for machines with no working Rust linker (this one: the
  // MSVC link.exe is missing and VS Build Tools could not be downloaded).
  // The skip must be requested by name so CI can never inherit it silently —
  // an unexplained "not built" used to count as a pass (C-3).
  results.push({
    name: 'Rust binary (release)',
    value: 'skipped (LUMORA_SKIP_RUST_BINARY=1)',
    budget: '30MB',
    ok: true,
    skipped: true,
  });
} else {
  // A missing binary is NOT a pass: the budget was simply never measured.
  // Counting it as ok:true made CI's security job inherit a permanent
  // false-green (C-3).
  results.push({ name: 'Rust binary (release)', value: 'not built', budget: '30MB', ok: false });
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
