// VM 桌面功能链路 E2E：排序 / 标签 / 精确搜索 / 批量删除
// 前置：VM 内 Lumora-debug 运行中（CDP 9222），D:\lumora-test-images 有 3 张图
import { chromium } from 'playwright-core';

const TEST_DIR = 'D:\\lumora-test-images-meta';
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

  // 前置：导入 3 张真实图片
  await tauriInvoke(page, 'import_images', { path: TEST_DIR });
  await page.reload();
  await page
    .getByRole('heading', { name: '创作者图库' })
    .waitFor({ timeout: 30_000 });
  await waitCards(page, 3);

  // 前置：第一张评分 4 + 收藏
  const firstCard = page.locator('[data-image-id]').first();
  const firstId = await firstCard.getAttribute('data-image-id');
  await firstCard.getByRole('button', { name: '4 梅花印' }).click();
  await firstCard.getByRole('button', { name: '收藏' }).click();
  await page.waitForTimeout(800);

  // 1. 按评分排序：评分 4 的图应排到第一张
  try {
    await page.getByRole('button', { name: '评分', exact: true }).click();
    await page.waitForTimeout(800);
    const firstRatingOpacity = await page
      .locator('[data-image-id]')
      .first()
      .locator('button[aria-label="4 梅花印"]')
      .evaluate((el) => getComputedStyle(el).opacity);
    if (firstRatingOpacity !== '1') {
      throw new Error(`4星按钮 opacity=${firstRatingOpacity}`);
    }
    record('按评分排序（评分最高排第一）', true);
  } catch (e) {
    record('按评分排序（评分最高排第一）', false, e.message.split('\n')[0]);
  }

  // 2. 标签：创建 → 关联图片 → 详情展示 → 删除
  try {
    await sidebar.getByRole('button', { name: '标签', exact: true }).click();
    await page
      .getByRole('heading', { name: '标签管理' })
      .waitFor({ timeout: 15_000 });
    const tagInput = page.getByPlaceholder('输入标签名称...');
    await tagInput.fill('测试标签');
    await page.getByRole('button', { name: '创建标签', exact: true }).click();
    await page.getByText('测试标签', { exact: true }).waitFor({ timeout: 10_000 });

    const tags = await tauriInvoke(page, 'list_tags');
    const tag = tags.find((x) => x.name === '测试标签');
    if (!tag) throw new Error('标签未写入数据库');
    await tauriInvoke(page, 'add_tag_to_image', {
      imageId: firstId,
      tagId: tag.id,
    });
    // 回图库刷新：卡片与详情应真实展示关联标签
    await sidebar
      .getByRole('button', { name: '创作者图库', exact: true })
      .click();
    await page
      .getByRole('heading', { name: '创作者图库' })
      .waitFor({ timeout: 15_000 });
    await waitCards(page, 3);
    await page
      .locator('[data-image-id]')
      .first()
      .getByText('测试标签', { exact: true })
      .waitFor({ timeout: 10_000 });
    await page.locator('[data-image-id]').first().click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: '图片详情' });
    await dialog.waitFor({ timeout: 10_000 });
    await dialog.getByText('测试标签', { exact: true }).waitFor({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached', timeout: 10_000 });
    record('标签创建→关联→卡片与详情真实展示', true);
  } catch (e) {
    await page.keyboard.press('Escape').catch(() => {});
    record('标签创建→关联→卡片与详情真实展示', false, e.message.split('\n')[0]);
  }

  // 3. 标签删除（标签页）
  try {
    await sidebar.getByRole('button', { name: '标签', exact: true }).click();
    await page
      .getByRole('heading', { name: '标签管理' })
      .waitFor({ timeout: 15_000 });
    const row = page.locator('div', { hasText: '测试标签' }).last();
    await row.getByRole('button', { name: '删除', exact: true }).click();
    await page.waitForFunction(
      () => !document.body.innerText.includes('测试标签'),
      { timeout: 10_000 },
    );
    record('标签删除', true);
  } catch (e) {
    record('标签删除', false, e.message.split('\n')[0]);
  }

  // 4. 精确搜索：搜文件名片段
  try {
    await sidebar.getByRole('button', { name: '语义搜索', exact: true }).click();
    await page
      .getByRole('heading', { name: '语义搜索' })
      .waitFor({ timeout: 15_000 });
    // 切到精确模式后 SemanticSearchBar 卸载，SearchPage 渲染精确搜索 section
    await page.getByRole('button', { name: '精确匹配', exact: true }).click();
    const searchInput = page.getByRole('textbox', { name: '文字描述' });
    await searchInput.waitFor({ timeout: 10_000 });
    await searchInput.fill('moonlight');
    await page.getByRole('button', { name: '搜索', exact: true }).click();
    await page
      .locator('section[aria-label="搜索结果"] article')
      .first()
      .waitFor({ timeout: 15_000 });
    const count = await page
      .locator('section[aria-label="搜索结果"] article')
      .count();
    if (count < 1) throw new Error(`结果数=${count}`);
    record('精确搜索命中 moonlight', true, `results=${count}`);
  } catch (e) {
    const body = await page.evaluate(() => document.body.innerText).catch(() => '');
    const invCount = await tauriInvoke(page, 'search_images', {
      query: 'moonlight',
    })
      .then((r) => r.length)
      .catch(() => -1);
    record(
      '精确搜索命中 moonlight',
      false,
      `${e.message.split('\n')[0]} | invoke=${invCount} | body=${body
        .replace(/\n+/g, ' ')
        .slice(0, 220)}`,
    );
  }

  // 5. 批量选择 + 批量删除
  try {
    await sidebar.getByRole('button', { name: '创作者图库', exact: true }).click();
    await page
      .getByRole('heading', { name: '创作者图库' })
      .waitFor({ timeout: 15_000 });
    await waitCards(page, 3);
    const cards = page.locator('[data-image-id]');
    await cards.nth(0).click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    const toolbar = page.getByText('已选 2 张', { exact: true });
    await toolbar.waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: '批量删除', exact: true }).click();
    await waitCards(page, 1);
    record('批量选择 2 张并批量删除（3→1）', true);
  } catch (e) {
    record('批量选择 2 张并批量删除（3→1）', false, e.message.split('\n')[0]);
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
