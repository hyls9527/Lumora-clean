// VM 桌面真实数据流 E2E：真实图片导入 + 评分/收藏/详情/筛选/删除/回收站/恢复/永久删除
// 前置：VM 内 Lumora-debug 运行中（CDP 9222），D:\lumora-test-images 有真实图片
import { chromium } from 'playwright-core';

const TEST_DIR = 'D:\\lumora-test-images';
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
    (n) => document.querySelectorAll('[data-image-id]').length === n,
    count,
    { timeout },
  );
}

async function run() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts().flatMap((c) => c.pages())[0];
  const sidebar = page.locator('aside[role="navigation"]');

  // 1. 真实导入
  try {
    const res = await tauriInvoke(page, 'import_images', { path: TEST_DIR });
    if (!res || res.imported + res.skipped < 3) {
      throw new Error(
        `imported=${res?.imported} skipped=${res?.skipped}`,
      );
    }
    record(
      '真实图片导入（3+ 张入数据库）',
      true,
      `imported=${res.imported} skipped=${res.skipped}`,
    );
  } catch (e) {
    record('真实图片导入（3+ 张入数据库）', false, e.message.split('\n')[0]);
  }

  // 刷新图库并等待卡片
  await page.reload();
  await page
    .getByRole('heading', { name: '创作者图库' })
    .waitFor({ timeout: 30_000 });
  await waitCards(page, 3);
  record('图库显示 3 张真实图片', true);

  const firstCard = page.locator('[data-image-id]').first();
  const firstId = await firstCard.getAttribute('data-image-id');

  // 2. 评分 4 星
  try {
    await firstCard.getByRole('button', { name: '4 梅花印' }).click();
    await page.waitForFunction(
      ([id]) =>
        window.__TAURI_INTERNALS__
          .invoke('list_images', { page: 1, perPage: 100 })
          .then((r) => r.items.find((x) => x.id === id)?.rating === 4),
      [firstId],
      { timeout: 10_000 },
    );
    record('评分 4 星（真实写入数据库）', true);
  } catch (e) {
    record('评分 4 星（真实写入数据库）', false, e.message.split('\n')[0]);
  }

  // 3. 收藏
  try {
    await firstCard.getByRole('button', { name: '收藏' }).click();
    await expectButton(firstCard, '取消收藏');
    await page.waitForFunction(
      ([id]) =>
        window.__TAURI_INTERNALS__
          .invoke('list_images', { page: 1, perPage: 100 })
          .then((r) => r.items.find((x) => x.id === id)?.favorite === true),
      [firstId],
      { timeout: 10_000 },
    );
    record('收藏（真实写入数据库）', true);
  } catch (e) {
    record('收藏（真实写入数据库）', false, e.message.split('\n')[0]);
  }

  // 4. 详情打开/关闭
  try {
    await firstCard.click();
    await page.waitForTimeout(500);
    await firstCard.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: '图片详情' });
    await dialog.waitFor({ timeout: 10_000 });
    await dialog.getByRole('button', { name: '4 梅花印' }).waitFor({ timeout: 5000 });
    await dialog.getByRole('button', { name: '取消收藏' }).waitFor({ timeout: 5000 });
    await dialog.getByRole('button', { name: '关闭' }).click();
    await dialog.waitFor({ state: 'detached', timeout: 10_000 });
    record('详情打开并展示评分/收藏状态', true);
  } catch (e) {
    await page.keyboard.press('Escape').catch(() => {});
    record('详情打开并展示评分/收藏状态', false, e.message.split('\n')[0]);
  }

  // 5. 仅收藏筛选
  try {
    await page.getByRole('button', { name: '◆ 仅收藏' }).click();
    await waitCards(page, 1);
    await page.getByRole('button', { name: '◆ 仅收藏' }).click();
    await waitCards(page, 3);
    record('仅收藏筛选 3→1→3', true);
  } catch (e) {
    record('仅收藏筛选 3→1→3', false, e.message.split('\n')[0]);
  }

  // 6. 删除到回收站
  try {
    await firstCard.getByRole('button', { name: '删除' }).click();
    await waitCards(page, 2);
    record('删除到回收站（图库 3→2）', true);
  } catch (e) {
    record('删除到回收站（图库 3→2）', false, e.message.split('\n')[0]);
  }

  // 7. 回收站 → 恢复
  try {
    await sidebar.getByRole('button', { name: '回收站', exact: true }).click();
    await page.getByRole('heading', { name: '回收站' }).waitFor({ timeout: 15_000 });
    const restore = page.getByRole('button', { name: '恢复' });
    await restore.waitFor({ timeout: 10_000 });
    await restore.click();
    await page.waitForFunction(
      () => !document.body.innerText.includes('恢复'),
      { timeout: 15_000 },
    );
    await sidebar.getByRole('button', { name: '创作者图库', exact: true }).click();
    await page
      .getByRole('heading', { name: '创作者图库' })
      .waitFor({ timeout: 15_000 });
    await waitCards(page, 3);
    record('回收站恢复（图库回 3）', true);
  } catch (e) {
    record('回收站恢复（图库回 3）', false, e.message.split('\n')[0]);
  }

  // 8. 再删除 → 永久删除
  try {
    await page
      .locator('[data-image-id]')
      .first()
      .getByRole('button', { name: '删除' })
      .click();
    await waitCards(page, 2);
    await sidebar.getByRole('button', { name: '回收站', exact: true }).click();
    await page.getByRole('heading', { name: '回收站' }).waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: '永久删除' }).first().click();
    await page.getByRole('button', { name: '确认删除' }).first().click();
    await page.waitForFunction(
      () => document.body.innerText.includes('回收站为空'),
      { timeout: 15_000 },
    );
    await sidebar.getByRole('button', { name: '创作者图库', exact: true }).click();
    await page
      .getByRole('heading', { name: '创作者图库' })
      .waitFor({ timeout: 15_000 });
    await waitCards(page, 2);
    record('永久删除（回收站清空，图库剩 2）', true);
  } catch (e) {
    record('永久删除（回收站清空，图库剩 2）', false, e.message.split('\n')[0]);
  }

  await browser.close();
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\nSUMMARY: ${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

async function expectButton(scope, name) {
  await scope
    .getByRole('button', { name })
    .waitFor({ timeout: 10_000 });
}

run().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(2);
});
