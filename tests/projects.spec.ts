import { test, expect } from '@playwright/test';

const UNIQUE = `テスト案件_${Date.now()}`;

test.describe('案件管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects.html');
    await expect(page.locator('#projects-tbody tr').first()).not.toContainText('読込中', { timeout: 8000 });
  });

  // ===== 表示 =====
  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page).toHaveTitle(/さくらリフォーム.*案件管理/);
  });

  test('Excelから32件インポートされている', async ({ page }) => {
    const rows = page.locator('#projects-tbody tr');
    await expect(rows).toHaveCount(32);
  });

  test('サマリーに案件数・受注総額が表示される', async ({ page }) => {
    const summary = page.locator('#summary-row');
    await expect(summary).toContainText('32');
    await expect(summary).toContainText('￥');
  });

  test('緊急タグがテーブルに表示される', async ({ page }) => {
    await expect(page.locator('.urgency-tag.critical').first()).toBeVisible();
  });

  test('緊急案件が先頭に並んでいる', async ({ page }) => {
    // 先頭行に緊急タグがある
    const firstRowTag = page.locator('#projects-tbody tr').first().locator('.urgency-tag');
    await expect(firstRowTag).toBeVisible();
  });

  // ===== フィルター =====
  test('ステータスフィルター：契約済 → 14件', async ({ page }) => {
    await page.selectOption('#filter-status', '契約済');
    await expect(page.locator('#projects-tbody tr')).toHaveCount(14);
  });

  test('ステータスフィルター：失注 → 2件', async ({ page }) => {
    await page.selectOption('#filter-status', '失注');
    await expect(page.locator('#projects-tbody tr')).toHaveCount(2);
  });

  test('工事種別フィルター：水回り → 絞り込まれる', async ({ page }) => {
    await page.selectOption('#filter-work', '水回り');
    const rows = page.locator('#projects-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(32);
  });

  test('テキスト検索：「山本」→ 山本を含む行のみ表示', async ({ page }) => {
    await page.fill('#search', '山本');
    await page.waitForTimeout(200);
    const rows = page.locator('#projects-tbody tr');
    for (const row of await rows.all()) {
      await expect(row).toContainText('山本');
    }
  });

  test('緊急フィルターボタン：緊急のみ表示される', async ({ page }) => {
    await page.click('#btn-urgent');
    await page.waitForTimeout(300);
    const rows = page.locator('#projects-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    // 全行に urgency-tag がある
    for (const row of await rows.all()) {
      await expect(row.locator('.urgency-tag')).toBeVisible();
    }
  });

  test('フィルターをリセットすると全件に戻る', async ({ page }) => {
    await page.selectOption('#filter-status', '契約済');
    await expect(page.locator('#projects-tbody tr')).toHaveCount(14);
    await page.selectOption('#filter-status', '');
    await expect(page.locator('#projects-tbody tr')).toHaveCount(32);
  });

  // ===== CRUD =====
  test('新規案件の追加・削除ができる', async ({ page }) => {
    // モーダルを開く
    await page.click('button:has-text("新規案件")');
    await expect(page.locator('#modal')).toHaveClass(/open/);
    await expect(page.locator('#modal-title')).toHaveText('新規案件登録');

    // フォーム入力
    await page.fill('#f-name', UNIQUE);
    await page.fill('#f-customer', 'テスト顧客');
    await page.selectOption('#f-work-type', '内装');
    await page.selectOption('#f-status', '商談中');
    await page.fill('#f-probability', '55');
    await page.fill('#f-estimated', '750000');

    // 保存
    await page.click('.modal-footer .btn-accent');
    await expect(page.locator('#modal')).not.toHaveClass(/open/);

    // 追加確認
    await expect(page.locator(`td:has-text("${UNIQUE}")`)).toBeVisible();
    await expect(page.locator('#projects-tbody tr')).toHaveCount(33);

    // 削除（クリーンアップ）
    const row = page.locator(`tr:has(td:has-text("${UNIQUE}"))`);
    page.once('dialog', d => d.accept());
    await row.locator('button:has-text("削除")').click();
    await expect(page.locator(`td:has-text("${UNIQUE}")`)).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('#projects-tbody tr')).toHaveCount(32);
  });

  test('案件名が空のまま保存しようとするとモーダルが閉じない', async ({ page }) => {
    await page.click('button:has-text("新規案件")');
    await expect(page.locator('#modal')).toHaveClass(/open/);
    // 案件名を空のまま保存
    await page.click('.modal-footer .btn-accent');
    // モーダルが残る
    await expect(page.locator('#modal')).toHaveClass(/open/);
    // 閉じる
    await page.click('.modal-close');
  });

  test('編集モーダルに既存データが表示される', async ({ page }) => {
    const firstRow = page.locator('#projects-tbody tr').first();
    const firstName = await firstRow.locator('td').first().innerText();
    await firstRow.locator('button:has-text("編集")').click();

    await expect(page.locator('#modal')).toHaveClass(/open/);
    await expect(page.locator('#modal-title')).toHaveText('案件編集');
    // フォームにデータが入っている
    const nameVal = await page.locator('#f-name').inputValue();
    expect(nameVal.length).toBeGreaterThan(0);
    await page.click('.modal-close');
  });

  test('モーダル外クリックで閉じる', async ({ page }) => {
    await page.click('button:has-text("新規案件")');
    await expect(page.locator('#modal')).toHaveClass(/open/);
    await page.locator('#modal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#modal')).not.toHaveClass(/open/);
  });
});
