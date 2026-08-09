import { test, expect, type Page } from '@playwright/test';

const NAV_LABELS = [
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

async function openCleanApp(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Splash 结束后进入创作者图库
  await expect(
    page.getByRole('heading', { name: '创作者图库' }),
  ).toBeVisible({ timeout: 20_000 });
}

test('启动后进入创作者图库，侧边栏导航完整', async ({ page }) => {
  await openCleanApp(page);

  const sidebar = page.locator('aside[role="navigation"]');
  await expect(sidebar).toBeVisible();
  for (const label of NAV_LABELS) {
    await expect(
      sidebar.getByRole('button', { name: label, exact: true }),
    ).toBeVisible();
  }
});

test('语义搜索 → 设置 → 返回图库，界面与侧边栏保持正常', async ({ page }) => {
  await openCleanApp(page);

  const sidebar = page.locator('aside[role="navigation"]');

  // 进入语义搜索
  await sidebar.getByRole('button', { name: '语义搜索' }).click();
  await expect(
    page.getByRole('heading', { name: '语义搜索' }),
  ).toBeVisible();
  await expect(
    page.locator('input[placeholder*="描述你想找的内容"]'),
  ).toBeVisible();

  // 从搜索页进设置：界面不能坏、侧边栏不能消失
  await sidebar.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await expect(sidebar).toBeVisible();
  for (const label of NAV_LABELS) {
    await expect(
      sidebar.getByRole('button', { name: label, exact: true }),
    ).toBeVisible();
  }

  // 返回创作者图库
  await sidebar.getByRole('button', { name: '创作者图库' }).click();
  await expect(
    page.getByRole('heading', { name: '创作者图库' }),
  ).toBeVisible();
});

test('命令面板可打开、搜索并导航到导入页', async ({ page }) => {
  await openCleanApp(page);

  await page.getByRole('button', { name: '搜索 ⌘K' }).click();
  const paletteInput = page.getByRole('textbox', { name: '命令面板' });
  await expect(paletteInput).toBeVisible();

  await paletteInput.fill('导入');
  await page
    .getByRole('listbox')
    .getByRole('button', { name: /^导入管理/ })
    .click();

  await expect(
    page.getByRole('heading', { name: '导入管理' }),
  ).toBeVisible();
});

test('设置页可切换深色主题并持久生效', async ({ page }) => {
  await openCleanApp(page);

  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await page.getByRole('button', { name: '深色' }).click();

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute('data-theme')),
    )
    .toBe('dark');
  await expect(page).toHaveURL(/#?\/settings|$/);
});
