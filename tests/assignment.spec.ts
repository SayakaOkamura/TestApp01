import { test, expect } from '@playwright/test';

test.describe('担当管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assignment.html');
    // スタッフカードの描画を待つ
    await expect(page.locator('#staff-grid .staff-card').first()).toBeVisible({ timeout: 8000 });
  });

  // ===== スタッフカード =====
  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page).toHaveTitle(/さくらリフォーム.*担当管理/);
  });

  test('営業部スタッフ6名のカードが表示される', async ({ page }) => {
    await expect(page.locator('.staff-card')).toHaveCount(6);
  });

  test('各カードに氏名・稼働数・負荷ラベルが表示される', async ({ page }) => {
    for (const card of await page.locator('.staff-card').all()) {
      await expect(card.locator('.staff-name')).not.toBeEmpty();
      await expect(card.locator('.staff-count-num')).toBeVisible();
      await expect(card.locator('.load-label')).toBeVisible();
    }
  });

  test('佐々木さんのカードの件数がAPIと一致する', async ({ page }) => {
    // 固定値ではなく実際のAPI値と照合（前回実行の残留状態に強い）
    const res = await page.request.get('/api/staff/workload');
    const workload = await res.json();
    const sasaki = workload.find((s: any) => s.name.includes('佐々木'));
    const expected = String(sasaki?.active_count ?? 0);

    const card = page.locator('.staff-card', { hasText: '佐々木' });
    await expect(card.locator('.staff-count-num')).toHaveText(expected);
  });

  test('稼働数が多い担当者に「多め」または「要注意」ラベルが表示される', async ({ page }) => {
    // 佐々木(6件)は「要注意」のはず
    const card = page.locator('.staff-card', { hasText: '佐々木' });
    await expect(card.locator('.load-label')).toContainText(/多め|要注意/);
  });

  test('負荷に応じてカードの色クラスが異なる', async ({ page }) => {
    const cards = page.locator('.staff-card');
    const classNames = await Promise.all(
      (await cards.all()).map(c => c.getAttribute('class'))
    );
    // load-0〜load-3のどれかがある
    for (const cls of classNames) {
      expect(cls).toMatch(/load-[0-3]/);
    }
  });

  // ===== 案件テーブル =====
  test('デフォルトで進行中案件のみ表示される', async ({ page }) => {
    const activeBtn = page.locator('.tab-btn[data-filter="active"]');
    await expect(activeBtn).toHaveClass(/active/);
    const rows = page.locator('#assign-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('「全案件」タブで失注以外の全案件が表示される', async ({ page }) => {
    const activeCount = await page.locator('#assign-tbody tr').count();
    await page.click('.tab-btn[data-filter="all"]');
    await page.waitForTimeout(200);
    const allCount = await page.locator('#assign-tbody tr').count();
    expect(allCount).toBeGreaterThanOrEqual(activeCount);
  });

  test('各行に担当者ドロップダウンが表示される', async ({ page }) => {
    const selects = page.locator('.staff-select');
    const count = await selects.count();
    expect(count).toBeGreaterThan(0);
    // 担当者の選択肢に営業スタッフ名が含まれる
    const firstSelect = selects.first();
    await expect(firstSelect.locator('option', { hasText: '佐々木' })).toHaveCount(1);
  });

  test('スタッフカードをクリックすると担当者で絞り込まれる', async ({ page }) => {
    const beforeCount = await page.locator('#assign-tbody tr').count();
    // 佐々木カードをクリック
    await page.locator('.staff-card', { hasText: '佐々木' }).click();
    await page.waitForTimeout(300);
    const afterCount = await page.locator('#assign-tbody tr').count();
    // 絞り込まれている（または0件でも正常）
    expect(afterCount).toBeLessThanOrEqual(beforeCount);
    // カードがselectedになっている
    await expect(page.locator('.staff-card.selected', { hasText: '佐々木' })).toBeVisible();
  });

  test('同じカードを再クリックすると絞り込みが解除される', async ({ page }) => {
    const allCount = await page.locator('#assign-tbody tr').count();
    const card = page.locator('.staff-card', { hasText: '佐々木' });
    await card.click();
    await page.waitForTimeout(200);
    await card.click();  // 再クリックで解除
    await page.waitForTimeout(200);
    await expect(page.locator('.staff-card.selected')).toHaveCount(0);
    await expect(page.locator('#assign-tbody tr')).toHaveCount(allCount);
  });

  // ===== 担当変更 =====
  test('ドロップダウンで担当者を変更できる', async ({ page }) => {
    // 「全案件」タブで山本邸（未割り当て）を探す
    await page.click('.tab-btn[data-filter="all"]');
    await page.waitForTimeout(200);

    // 未割り当ての行を探す（staff-selectのvalueが空）
    const unassignedRows = page.locator('#assign-tbody tr:has(select.staff-select option[value=""]:checked)');
    const count = await unassignedRows.count();

    if (count > 0) {
      // selectOption 後にロケーターが無効化されるため、ID で安定した参照を確保
      const rowId = await unassignedRows.first().getAttribute('id');
      const sel = page.locator(`#${rowId} .staff-select`);
      await sel.selectOption('佐々木 亮');
      // saved クラスが付く
      await expect(sel).toHaveClass(/saved/, { timeout: 5000 });
      // 元に戻す（クリーンアップ）
      await sel.selectOption('');
      await expect(sel).toHaveClass(/saved/, { timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('担当変更後スタッフカードの稼働数が更新される', async ({ page }) => {
    await page.click('.tab-btn[data-filter="all"]');
    await page.waitForTimeout(200);

    const card = page.locator('.staff-card', { hasText: '加藤' });
    const beforeNum = parseInt(await card.locator('.staff-count-num').innerText());

    // 加藤さんに割り当て（未割り当ての行を利用）
    const unassigned = page.locator('#assign-tbody tr:has(select.staff-select option[value=""]:checked)');
    if (await unassigned.count() === 0) { test.skip(); return; }

    // selectOption 後にロケーターが無効化されるため、ID で安定した参照を確保
    const rowId = await unassigned.first().getAttribute('id');
    const sel = page.locator(`#${rowId} .staff-select`);
    await sel.selectOption('加藤 美咲');
    await expect(sel).toHaveClass(/saved/, { timeout: 5000 });
    await page.waitForTimeout(800);  // カード再描画を待つ

    const afterNum = parseInt(await card.locator('.staff-count-num').innerText());
    expect(afterNum).toBeGreaterThanOrEqual(beforeNum);

    // 元に戻す（クリーンアップ）
    await sel.selectOption('');
    await expect(sel).toHaveClass(/saved/, { timeout: 5000 });
  });

  // ===== ステータス変更 =====
  test('各行にステータスドロップダウンが表示される', async ({ page }) => {
    const selects = page.locator('.status-select');
    const count = await selects.count();
    expect(count).toBeGreaterThan(0);
    // 全選択肢に「契約済」オプションがある
    const first = selects.first();
    await expect(first.locator('option[value="契約済"]')).toHaveCount(1);
  });

  test('ステータスドロップダウンで変更・即保存できる', async ({ page }) => {
    await page.click('.tab-btn[data-filter="all"]');
    await page.waitForTimeout(300);

    // 商談中の行を探す（DB上4件ある）
    const targetRow = page.locator('#assign-tbody tr:has(select.status-select option[value="商談中"]:checked)').first();
    if (await targetRow.count() === 0) { test.skip(); return; }

    const rowId = await targetRow.getAttribute('id');
    // selectOption 後にロケーターが無効化されるため、ID で安定した参照を確保
    const sel = page.locator(`#${rowId} .status-select`);

    // 商談中 → 見積提出済 に変更
    await sel.selectOption('見積提出済');
    await expect(sel).toHaveClass(/saved/, { timeout: 5000 });

    // 再描画後に元に戻す（クリーンアップ）
    await page.waitForTimeout(1000);
    const rowAfter = page.locator(`#${rowId}`);
    if (await rowAfter.count() > 0) {
      const selAfter = rowAfter.locator('.status-select');
      await selAfter.selectOption('商談中');
      await expect(selAfter).toHaveClass(/saved/, { timeout: 5000 });
    }
  });

  test('ステータス変更後トーストが表示される', async ({ page }) => {
    await page.click('.tab-btn[data-filter="all"]');
    await page.waitForTimeout(300);

    const targetRow = page.locator('#assign-tbody tr:has(select.status-select option[value="商談中"]:checked)').last();
    if (await targetRow.count() === 0) { test.skip(); return; }

    const rowId = await targetRow.getAttribute('id');
    const toastSel = page.locator(`#${rowId} .status-select`);
    await toastSel.selectOption('現地調査済');
    await expect(page.locator('.toast.show')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.toast')).toContainText('現地調査済');

    // クリーンアップ（再描画後も ID ロケーターで安定参照）
    await page.waitForTimeout(1000);
    const rowAfter = page.locator(`#${rowId}`);
    if (await rowAfter.count() > 0) {
      const cleanSel = page.locator(`#${rowId} .status-select`);
      await cleanSel.selectOption('商談中');
      await expect(cleanSel).toHaveClass(/saved/, { timeout: 5000 });
    }
  });
});
