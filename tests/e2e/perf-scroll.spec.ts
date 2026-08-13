import { test, expect } from '@playwright/test';

// Headless CI frame timing is noisy; this is a local baseline for TC-PERF-002.
test.skip(!!process.env.CI, 'CI 无头环境的帧时序不可靠，本地运行作为自动化基线');

test('10K 图库虚拟滚动帧率基线（p95 ≥30fps）', async ({ page }) => {
  await page.goto('/perf-harness.html');

  const result = await page.evaluate(async () => {
    const scroller = Array.from(document.querySelectorAll<HTMLElement>('div')).find(
      (el) => el.scrollHeight > el.clientHeight + 100,
    );
    if (!scroller) return { error: 'scroller-not-found' };

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    const samples: number[] = [];
    let last = performance.now();
    const durationMs = 3000;
    const start = performance.now();

    await new Promise<void>((resolve) => {
      const step = () => {
        const now = performance.now();
        samples.push(now - last);
        last = now;
        const t = now - start;
        scroller.scrollTop =
          (t / durationMs) * (scroller.scrollHeight - scroller.clientHeight);
        if (t < durationMs) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

    const warm = samples.slice(5).sort((a, b) => a - b);
    const p95 = warm[Math.floor(warm.length * 0.95)] ?? 0;
    const avg = warm.reduce((a, b) => a + b, 0) / warm.length;
    return {
      frames: samples.length,
      avgMs: Number(avg.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      fps: Number((1000 / p95).toFixed(1)),
    };
  });

  expect(result.error).toBeUndefined();
  console.log(`TC-PERF-002 baseline: ${JSON.stringify(result)}`);
  expect(result.fps).toBeGreaterThanOrEqual(30);
});
