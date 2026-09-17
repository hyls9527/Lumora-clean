import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    teardownTimeout: 1000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      // 验收指标「核心测试覆盖率 ≥80%」. Measured 2026-09: 87.8% stmts/lines,
      // 81.4% branches, 73.4% functions — the floor sits below the measured
      // value so ordinary drift does not turn CI red, but a real regression
      // (deleting tests, adding a large untested module) fails the build.
      thresholds: {
        statements: 80,
        branches: 78,
        functions: 70,
        lines: 80,
      },
    },
  },
});
