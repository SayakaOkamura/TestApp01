import { test, expect } from '@playwright/test';

const UNIQUE = `テスト顧客_${Date.now()}`;

test.describe('顧客管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/customers.html');
    await expect(page.locator('#customers-tbody tr').first()).not.toContainText('読込中', { timeout: 8000 });
  });

  // ===== 表示 =====
  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page).toHaveTitle(/さくらリフォーム.*顧客管理/);
  });

  test('Excelから30件インポートされている', async ({ page }) => {
    await expect(page.locator('#customers-tbody tr')).toHaveCount(30);
  });

  test('サマリーに件数・建物種別内訳が表示される', async ({ page }) => {
    const summary = page.locator('#summary-row');
    await expect(summary).toContainText('30');
    await expect(summary).toContainText('一戸建て');
    await expect(summary).toContainText('マンション');
  });

  test('各行に住所・建物種別・担当者が表示される', async ({ page }) => {
    const firstRow = page.locator('#customers-tbody tr').first();
    // 8列ある（氏名・住所・建物種別・築年数・来店経路・担当者・電話番号・操作）
    const cells = firstRow.locator('td');
    await expect(cells).toHaveCount(8);
  });

  // ===== フィルター =====
  test('建物種別フィルター：一戸建て → マンション以外に絞られる', async ({ page }) => {
    await page.selectOption('#filter-building', '一戸建て');
    const rows = page.locator('#customers-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(30);
    for (const row of await rows.all()) {
      await expect(row).toContainText('一戸建て');
    }
  });

  test('テキスト検索：「横浜」→ 横浜を含む行のみ', async ({ page }) => {
    await page.fill('#search', '横浜');
    await page.waitForTimeout(200);
    const rows = page.locator('#customers-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      await expect(row).toContainText('横浜');
    }
  });

  test('フィルターリセットで全件に戻る', async ({ page }) => {
    await page.selectOption('#filter-building', 'マンション');
    const filtered = await page.locator('#customers-tbody tr').count();
    expect(filtered).toBeLessThan(30);
    await page.selectOption('#filter-building', '');
    await expect(page.locator('#customers-tbody tr')).toHaveCount(30);
  });

  // ===== CRUD =====
  test('新規顧客の追加・削除ができる', async ({ page }) => {
    // モーダルを開く
    await page.click('button:has-text("新規顧客")');
    await expect(page.locator('#modal')).toHaveClass(/open/);

    // フォーム入力
    await page.fill('#f-name', UNIQUE);
    await page.fill('#f-phone', '03-0000-9999');
    await page.fill('#f-address', '東京都テスト区1-1-1');
    await page.selectOption('#f-building-type', '一戸建て');
    await page.fill('#f-age', '10');
    await page.selectOption('#f-source', 'WEB検索');
    await page.selectOption('#f-staff', '佐々木');

    // 保存
    await page.click('.modal-footer .btn-accent');
    await expect(page.locator('#modal')).not.toHaveClass(/open/);

    // 追加確認
    await expect(page.locator(`td:has-text("${UNIQUE}")`)).toBeVisible();
    await expect(page.locator('#customers-tbody tr')).toHaveCount(31);

    // 削除（クリーンアップ）
    const row = page.locator(`tr:has(td:has-text("${UNIQUE}"))`);
    page.once('dialog', d => d.accept());
    await row.locator('button:has-text("削除")').click();
    await expect(page.locator(`td:has-text("${UNIQUE}")`)).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('#customers-tbody tr')).toHaveCount(30);
  });

  test('顧客名が空のまま保存しようとするとモーダルが閉じない', async ({ page }) => {
    await page.click('button:has-text("新規顧客")');
    await page.click('.modal-footer .btn-accent');
    await expect(page.locator('#modal')).toHaveClass(/open/);
    await page.click('.modal-close');
  });

  test('編集モーダルに既存データが表示される', async ({ page }) => {
    await page.locator('#customers-tbody tr').first().locator('button:has-text("編集")').click();
    await expect(page.locator('#modal')).toHaveClass(/open/);
    await expect(page.locator('#modal-title')).toHaveText('顧客編集');
    const nameVal = await page.locator('#f-name').inputValue();
    expect(nameVal.length).toBeGreaterThan(0);
    await page.click('.modal-close');
  });
});
