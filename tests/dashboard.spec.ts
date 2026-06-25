import { test, expect } from '@playwright/test';

test.describe('ダッシュボード', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // API読み込み完了を待つ
    await expect(page.locator('#kpi-contracted')).not.toHaveText('読込中…', { timeout: 8000 });
  });

  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page).toHaveTitle(/さくらリフォーム.*ダッシュボード/);
  });

  test('サイドバーナビゲーション5項目が表示される', async ({ page }) => {
    const nav = page.locator('.sidebar-nav li');
    await expect(nav).toHaveCount(5);
    await expect(page.locator('.sidebar-nav li.active a')).toContainText('ダッシュボード');
  });

  test('KPIカードが4つ表示されすべて金額を持つ', async ({ page }) => {
    const cards = page.locator('.kpi-card');
    await expect(cards).toHaveCount(4);
    for (const card of await cards.all()) {
      // ja-JP ロケールは全角円記号（￥）を使う
      await expect(card.locator('.kpi-value')).toContainText('￥');
    }
  });

  test('受注総額が10,310,000円（Excelデータ一致）', async ({ page }) => {
    await expect(page.locator('#kpi-contracted')).toHaveText(/10,310,000/);
  });

  test('未入金残高が正の金額', async ({ page }) => {
    const text = await page.locator('#kpi-unpaid').innerText();
    const amount = parseInt(text.replace(/[^\d]/g, ''));
    expect(amount).toBeGreaterThan(0);
  });

  test('緊急アラートセクションが表示される', async ({ page }) => {
    await expect(page.locator('#urgent-section')).toBeVisible();
    // データ読み込み後は内容がある
    await expect(page.locator('#urgent-section')).not.toBeEmpty();
  });

  test('緊急案件（雨漏り）がアラートに表示される', async ({ page }) => {
    // 小野邸か福田邸のどちらかがcriticalとして表示される
    await expect(page.locator('.alert-reason.critical').first()).toBeVisible();
    const panel = page.locator('.alert-panel');
    const text = await panel.innerText();
    expect(text).toMatch(/雨漏り|急ぎ|緊急対応/);
  });

  test('緊急パネルの件数バッジが2件', async ({ page }) => {
    const badge = page.locator('.alert-count-badge.critical');
    await expect(badge).toHaveText('2件');
  });

  test('3つのチャートcanvasが存在する', async ({ page }) => {
    await expect(page.locator('#statusChart')).toBeVisible();
    await expect(page.locator('#staffChart')).toBeVisible();
    await expect(page.locator('#workTypeChart')).toBeVisible();
  });

  test('未入金一覧テーブルに行がある', async ({ page }) => {
    await expect(page.locator('#unpaid-list tr').first()).not.toContainText('読込中');
    const rows = page.locator('#unpaid-list tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('商談中案件テーブルに行がある', async ({ page }) => {
    const rows = page.locator('#pipeline-list tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('案件管理ページへ遷移できる', async ({ page }) => {
    await page.click('a[href="projects.html"]');
    await expect(page).toHaveURL(/projects\.html/);
    await expect(page).toHaveTitle(/案件管理/);
  });
});
