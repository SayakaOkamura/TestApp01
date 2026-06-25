import { test, expect } from '@playwright/test';

const UNIQUE = `テスト案件請求_${Date.now()}`;

test.describe('請求・入金管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/invoices.html');
    await expect(page.locator('#invoices-tbody tr').first()).not.toContainText('読込中', { timeout: 8000 });
  });

  // ===== 表示 =====
  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page).toHaveTitle(/さくらリフォーム.*請求/);
  });

  test('Excelから21件インポートされている', async ({ page }) => {
    await expect(page.locator('#invoices-tbody tr')).toHaveCount(21);
  });

  test('KPIカードに入金済・未入金・件数が表示される', async ({ page }) => {
    await expect(page.locator('#kpi-received')).toContainText('￥');
    await expect(page.locator('#kpi-unpaid')).toContainText('￥');
    await expect(page.locator('#kpi-count')).toContainText('21');
  });

  test('未入金残高が正の値', async ({ page }) => {
    const text = await page.locator('#kpi-unpaid').innerText();
    const amount = parseInt(text.replace(/[^\d]/g, ''));
    expect(amount).toBeGreaterThan(0);
  });

  test('未入金の行に「入金済に」ボタンが表示される', async ({ page }) => {
    const paidBtns = page.locator('button:has-text("入金済に")');
    const count = await paidBtns.count();
    expect(count).toBeGreaterThan(0);
  });

  test('入金済の行には「入金済に」ボタンが表示されない', async ({ page }) => {
    const paidRows = page.locator('tr:has(.badge-paid)');
    for (const row of await paidRows.all()) {
      await expect(row.locator('button:has-text("入金済に")')).toHaveCount(0);
    }
  });

  test('期限超過の行が赤くハイライトされている', async ({ page }) => {
    // 既存データに期限超過（2024年期限）がある
    const overdueRows = page.locator('tr[style*="background:#fff8f8"]');
    const count = await overdueRows.count();
    expect(count).toBeGreaterThan(0);
  });

  // ===== フィルター =====
  test('未入金フィルター → 未入金のみ表示', async ({ page }) => {
    await page.selectOption('#filter-status', '未入金');
    const rows = page.locator('#invoices-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(21);
    // すべて未入金バッジ
    for (const row of await rows.all()) {
      await expect(row.locator('.badge-unpaid, .badge-overdue')).toBeVisible();
    }
  });

  test('入金済フィルター → 入金済のみ表示', async ({ page }) => {
    await page.selectOption('#filter-status', '入金済');
    const rows = page.locator('#invoices-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      await expect(row.locator('.badge-paid')).toBeVisible();
    }
  });

  test('検索：案件名で絞り込みできる', async ({ page }) => {
    await page.fill('#search', '高橋');
    await page.waitForTimeout(200);
    const rows = page.locator('#invoices-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      await expect(row).toContainText('高橋');
    }
  });

  // ===== CRUD =====
  test('新規請求の追加・削除ができる', async ({ page }) => {
    await page.click('button:has-text("新規請求")');
    await expect(page.locator('#modal')).toHaveClass(/open/);

    await page.fill('#f-project', UNIQUE);
    await page.fill('#f-customer', 'テスト顧客');
    await page.selectOption('#f-type', '一括');
    await page.fill('#f-amount', '300000');
    await page.fill('#f-invoice-date', '2026-06-01');
    await page.fill('#f-due-date', '2026-07-01');

    await page.click('.modal-footer .btn-success');
    await expect(page.locator('#modal')).not.toHaveClass(/open/);

    await expect(page.locator(`td:has-text("${UNIQUE}")`)).toBeVisible();
    await expect(page.locator('#invoices-tbody tr')).toHaveCount(22);

    // 削除（クリーンアップ）
    const row = page.locator(`tr:has(td:has-text("${UNIQUE}"))`);
    page.once('dialog', d => d.accept());
    await row.locator('button:has-text("削除")').click();
    await expect(page.locator(`td:has-text("${UNIQUE}")`)).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('#invoices-tbody tr')).toHaveCount(21);
  });

  test('案件名が空のまま保存しようとするとモーダルが閉じない', async ({ page }) => {
    await page.click('button:has-text("新規請求")');
    await page.click('.modal-footer .btn-success');
    await expect(page.locator('#modal')).toHaveClass(/open/);
    await page.click('.modal-close');
  });

  test('「入金済に」ボタンで入金ステータスが変わる', async ({ page }) => {
    // 新規請求を追加して入金処理をテスト
    await page.click('button:has-text("新規請求")');
    await page.fill('#f-project', UNIQUE + '_pay');
    await page.fill('#f-customer', 'テスト顧客');
    await page.fill('#f-amount', '100000');
    await page.fill('#f-invoice-date', '2026-06-01');
    await page.fill('#f-due-date', '2026-07-01');
    await page.click('.modal-footer .btn-success');
    await expect(page.locator('#modal')).not.toHaveClass(/open/);

    // 入金済に変更
    const row = page.locator(`tr:has(td:has-text("${UNIQUE + '_pay'}"))`);
    await row.locator('button:has-text("入金済に")').click();
    await page.waitForTimeout(600);

    // 入金済バッジに変わる
    await expect(row.locator('.badge-paid')).toBeVisible();
    await expect(row.locator('button:has-text("入金済に")')).toHaveCount(0);

    // クリーンアップ
    page.once('dialog', d => d.accept());
    await row.locator('button:has-text("削除")').click();
    await expect(page.locator(`td:has-text("${UNIQUE + '_pay'}")`)).not.toBeVisible({ timeout: 5000 });
  });
});
