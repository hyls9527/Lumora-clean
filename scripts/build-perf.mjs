#!/usr/bin/env node
/**
 * Production build **plus** the standalone measurement pages.
 *
 * `npm run build` ships only the app; the perf harness (`perf-harness.html`)
 * and the UI preview are dev tools and would otherwise inflate the shipped
 * bundle (and the size budget that guards it). The Playwright perf project
 * needs them inside a real production build, so it calls this script.
 *
 * Cross-platform on purpose: no `set VAR=1&&` shell trick, no extra dep.
 */

import { spawnSync } from 'node:child_process';

const res = spawnSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, LUMORA_PERF_BUILD: '1' },
});
process.exit(res.status ?? 1);
