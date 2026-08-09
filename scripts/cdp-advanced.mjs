// VM 桌面高级链路 E2E：变体组对比 / 真实导出 / AI 控制 / 智能收藏
// 前置：Lumora-debug（CDP 9222）；D:\lumora-test-images-meta（3 张带元数据）；
//       D:\lumora-test-images-variant（2 张同 prompt 变体图）
import { chromium } from 'playwright-core';

const META_DIR = 'D:\\lumora-test-images-meta';
const VARIANT_DIR = 'D:\\lumora-test-images-variant';
const EXPORT_DIR = 'D:\\lumora-export-test';
const results = [];

function record(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function tauriInvoke(page, cmd, args = {}) {
  return page.evaluate(
    ([c, a]) => window.__TAURI_INTERNALS__.invoke(c, a),
    [cmd, args],
  );
}

async function waitCards(page, count, timeout = 20_000) {
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-image-id]').length >= n,
    count,
    { timeout },
  );
}

async function run() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts().flatMap((c) => c.pages())[0];
  const sidebar = page.locator('aside[role="navigation"]');

  // 前置：导入 3 张元数据图 + 2 张变体图
  await tauriInvoke(page, 'import_images', { path: META_DIR });
  await tauriInvoke(page, 'import_images', { path: VARIANT_DIR });
  await page.reload();
  await page
    .getByRole('heading', { name: '创作者图库' })
    .waitFor({ timeout: 30_000 });
  // LazyLoad 只渲染视口内卡片；总数以数据库/页脚“共 N 张”为准
  await waitCards(page, 4);
  await page.waitForFunction(
    () => document.body.innerText.includes('共 5 张'),
    { timeout: 10_000 },
  );
  record('图库共 5 张真实图片（3 元数据 + 2 变体）', true);

  const firstCard = page.locator('[data-image-id]').first();

  // 1. 变体组对比
  try {
    await firstCard.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: '图片详情' });
    await dialog.waitFor({ timeout: 10_000 });
    // WebView2 下 Playwright 定位器对该按钮不稳定，直接 DOM 驱动点击
    const clicked = await page.evaluate(() => {
      const btn = Array.from(
        document.querySelectorAll('[role="dialog"] button'),
      ).find((b) => (b.textContent ?? '').includes('对比变体'));
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!clicked) throw new Error('对比变体按钮未找到');
    await page.waitForFunction(
      () => !!document.querySelector('[role="dialog"][aria-label="对比变体"]'),
      { timeout: 10_000 },
    );
    const thumbCount = await page.evaluate(
      () =>
        document.querySelectorAll(
          '[role="dialog"][aria-label="对比变体"] button',
        ).length,
    );
    if (thumbCount < 2) {
      throw new Error(`对比缩略图数量=${thumbCount}`);
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"][aria-label="对比变体"]'),
      { timeout: 10_000 },
    );
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"][aria-label="图片详情"]'),
      { timeout: 10_000 },
    );
    record('变体组对比（同 prompt 2 张）', true);
  } catch (e) {
    const dlgInfo = await page
      .evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        if (!d) return null;
        return {
          label: d.getAttribute('aria-label'),
          text: d.textContent?.slice(0, 200) ?? '',
          buttons: Array.from(d.querySelectorAll('button')).map((b) =>
            (b.getAttribute('aria-label') ?? b.textContent ?? '').trim(),
          ),
        };
      })
      .catch(() => null);
    const body = await page
      .evaluate(() => document.body.innerText)
      .catch(() => '');
    await page.keyboard.press('Escape').catch(() => {});
    record(
      '变体组对比（同 prompt 2 张）',
      false,
      `${e.message.split('\n')[0]} | dlg=${JSON.stringify(dlgInfo)} | ${body
        .replace(/\n+/g, ' ')
        .slice(0, 220)}`,
    );
  }

  // 给第一张（最新导入的变体图）评 4 分，供智能收藏使用
  await firstCard.getByRole('button', { name: '4 梅花印' }).click();
  await page.waitForTimeout(500);

  // 2. 真实导出（写文件）
  try {
    const list = await tauriInvoke(page, 'list_images', { page: 1, perPage: 100 });
    const ids = list.items.slice(0, 3).map((x) => x.id);
    const res = await tauriInvoke(page, 'export_images', {
      ids,
      destDir: EXPORT_DIR,
      format: 'png',
      renameTemplate: null,
    });
    const success = res?.success ?? res?.successCount ?? 0;
    if (!res || success < 3) {
      throw new Error(`success=${success}`);
    }
    record('导出 3 张真实图片到目录', true, `success=${success}`);
  } catch (e) {
    record('导出 3 张真实图片到目录', false, e.message.split('\n')[0]);
  }

  // 3. AI 控制：自然语言打开设置
  try {
    await page.getByRole('button', { name: '搜索 ⌘K' }).click();
    await page.getByRole('button', { name: 'AI 控制', exact: true }).click();
    const aiInput = page.getByPlaceholder('用一句话告诉 Lumora 你想做什么…');
    await aiInput.waitFor({ timeout: 10_000 });
    await aiInput.fill('打开设置');
    await page.getByRole('button', { name: '执行', exact: true }).click();
    await page
      .getByRole('heading', { name: '设置' })
      .waitFor({ timeout: 15_000 });
    record('AI 控制「打开设置」跳转成功', true);
  } catch (e) {
    record('AI 控制「打开设置」跳转成功', false, e.message.split('\n')[0]);
  }

  // 4. 智能收藏：创建规则 评分≥4
  try {
    await sidebar.getByRole('button', { name: '智能收藏', exact: true }).click();
    await page
      .getByRole('heading', { name: '智能收藏' })
      .waitFor({ timeout: 15_000 });
    // 幂等：集合已存在（上次运行创建）则直接通过
    const existing = page.getByText('高分作品', { exact: true });
    if (await existing.count()) {
      record('智能收藏规则 评分≥4（已存在，幂等通过）', true);
      await browser.close();
      const failed = results.filter((r) => r.startsWith('FAIL')).length;
      console.log(`\nSUMMARY: ${results.length - failed}/${results.length} passed`);
      process.exit(failed > 0 ? 1 : 0);
    }
    await page.getByRole('button', { name: /新建收藏/ }).click();
    const editor = page.getByPlaceholder('输入收藏名称');
    await editor.waitFor({ timeout: 10_000 });
    await editor.fill('高分作品');

    // 规则行：字段 select → 评分；op select → 大于等于；值 → 4
    const selects = page.locator('select');
    await selects.nth(0).selectOption('rating');
    await selects.nth(1).selectOption('gte');
    await page.getByPlaceholder('规则值').fill('4');
    await page.getByRole('button', { name: '保存', exact: true }).click();

    await page
      .getByText('高分作品', { exact: true })
      .waitFor({ timeout: 10_000 });
    await page.getByText('评分 ≥ 4', { exact: true }).waitFor({ timeout: 10_000 });
    record('智能收藏规则 评分≥4 创建成功', true);
  } catch (e) {
    record('智能收藏规则 评分≥4 创建成功', false, e.message.split('\n')[0]);
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
