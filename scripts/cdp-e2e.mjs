// VM 桌面真实交互 E2E：通过 CDP 连接正在运行的 Lumora WebView2，
// 用 Playwright 驱动真实桌面应用（Tauri + WebView2 + 真实数据库）。
import { chromium } from 'playwright-core';

const NAV = [
  '创作者图库',
  '收藏',
  '智能收藏',
  '仪表盘',
  '导入管理',
  '语义搜索',
  '标签',
  '导出',
  '设置',
  '回收站',
];

const results = [];

function record(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function run() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const pages = browser.contexts().flatMap((c) => c.pages());
  if (pages.length === 0) throw new Error('CDP 无页面');
  const page = pages[0];

  const sidebar = page.locator('aside[role="navigation"]');

  // 1. 启动后进入创作者图库
  try {
    await page
      .getByRole('heading', { name: '创作者图库' })
      .waitFor({ timeout: 30_000 });
    record('启动后进入创作者图库', true);
  } catch (e) {
    record('启动后进入创作者图库', false, e.message.split('\n')[0]);
  }

  // 2. 侧边栏导航完整
  try {
    for (const label of NAV) {
      await sidebar
        .getByRole('button', { name: label, exact: true })
        .waitFor({ timeout: 10_000 });
    }
    record('侧边栏导航完整', true);
  } catch (e) {
    record('侧边栏导航完整', false, e.message.split('\n')[0]);
  }

  // 3. 语义搜索 → 设置 → 返回图库
  try {
    await sidebar.getByRole('button', { name: '语义搜索', exact: true }).click();
    await page
      .getByRole('heading', { name: '语义搜索' })
      .waitFor({ timeout: 15_000 });
    await page
      .locator('input[placeholder*="描述你想找的内容"]')
      .waitFor({ timeout: 10_000 });

    await sidebar.getByRole('button', { name: '设置', exact: true }).click();
    await page
      .getByRole('heading', { name: '设置' })
      .waitFor({ timeout: 15_000 });
    for (const label of NAV) {
      await sidebar
        .getByRole('button', { name: label, exact: true })
        .waitFor({ timeout: 10_000 });
    }

    await sidebar.getByRole('button', { name: '创作者图库', exact: true }).click();
    await page
      .getByRole('heading', { name: '创作者图库' })
      .waitFor({ timeout: 15_000 });
    record('语义搜索 → 设置 → 返回图库', true);
  } catch (e) {
    record('语义搜索 → 设置 → 返回图库', false, e.message.split('\n')[0]);
  }

  // 4. 命令面板导航到导入页
  try {
    await page.getByRole('button', { name: '搜索 ⌘K' }).click();
    const paletteInput = page.getByRole('textbox', { name: '命令面板' });
    await paletteInput.waitFor({ timeout: 10_000 });
    await paletteInput.fill('导入');
    await page
      .getByRole('listbox')
      .getByRole('button', { name: /^导入管理/ })
      .click();
    await page
      .getByRole('heading', { name: '导入管理' })
      .waitFor({ timeout: 15_000 });
    record('命令面板导航到导入页', true);
  } catch (e) {
    record('命令面板导航到导入页', false, e.message.split('\n')[0]);
  }

  // 5. 设置页深色主题切换
  try {
    await sidebar.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('heading', { name: '设置' }).waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: '深色' }).click();
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'dark',
      { timeout: 10_000 },
    );
    record('设置页深色主题切换', true);
  } catch (e) {
    record('设置页深色主题切换', false, e.message.split('\n')[0]);
  }

  await browser.close();

  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\nSUMMARY: ${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(2);
});
