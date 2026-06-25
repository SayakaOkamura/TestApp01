/**
 * E2Eテストレポート生成スクリプト
 *
 * - testcases-meta.json を永続ストアとして差分更新（既存の操作/期待値は上書きしない）
 * - テスト結果を test-report.md として出力
 */
const fs   = require('fs');
const path = require('path');

const DIR          = path.join(__dirname, 'レポート');
const RESULTS_PATH = path.join(DIR, 'playwright-results.json');
const META_PATH    = path.join(DIR, 'testcases-meta.json');
const OUTPUT_PATH  = path.join(DIR, 'test-report.md');

const raw = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));

// ===== 既存メタデータ読み込み =====
let meta = {};
if (fs.existsSync(META_PATH)) {
  meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
}

// ===== ファイル名 → 画面名 =====
const FILE_PAGE_MAP = {
  'dashboard.spec.ts':   'ダッシュボード',
  'projects.spec.ts':    '案件管理',
  'assignment.spec.ts':  '担当管理',
  'customers.spec.ts':   '顧客管理',
  'invoices.spec.ts':    '請求・入金管理',
};

// ===== テスト観点分類 =====
function classifyPerspective(title) {
  if (/空のまま|モーダルが閉じない/.test(title))                                      return 'バリデーション';
  if (/遷移できる|ページへ遷移/.test(title))                                          return '画面遷移';
  if (/追加・削除|ステータスが変わる|入金ステータス|「入金済に」ボタンで/.test(title)) return 'CRUD操作';
  if (/テキスト検索|検索[：:]|で絞り込みできる/.test(title))                          return '検索機能';
  if (/フィルター|絞り込まれる|リセットすると|全件に戻る/.test(title))                return 'フィルター機能';
  if (/クリックすると|再クリック|モーダル外|ドロップダウンで.*変更|即保存|稼働数が更新|ボタンで.*変わる/.test(title)) return 'UI操作';
  if (/Excelから|インポート|APIと一致|テーブルに行がある/.test(title))                 return 'データ確認';
  return '表示確認';
}

// ===== 正常/異常 =====
const ABNORMAL = ['空のまま', 'モーダルが閉じない', 'エラー', '不正', 'バリデーション', '表示されない'];
function classify(title) {
  return ABNORMAL.some(p => title.includes(p)) ? '異常' : '正常';
}

// ===== 丸数字ステップ =====
const C = ['①','②','③','④','⑤'];
function steps(arr) { return arr.map((s, i) => C[i] + s).join('\n'); }

// ===== 操作 自動生成 =====
function generateOperation(title, pageName) {
  const open = `${pageName}画面を開く`;
  const fc = title.match(/フィルター[：:]\s*「?(.+?)」?\s*→/);
  if (fc) return steps([open, `フィルターで「${fc[1]}」を選択する`]);
  const ts = title.match(/テキスト検索[：:]\s*「(.+?)」/);
  if (ts) return steps([open, `検索ボックスに「${ts[1]}」と入力する`]);
  if (/検索[：:].*絞り込み/.test(title)) return steps([open, '検索ボックスにキーワードを入力する']);
  if (/追加・削除/.test(title)) {
    const m = title.match(/新規(.+?)の追加・削除/);
    const lb = m ? m[1] : 'データ';
    return steps([open, `「新規${lb}」ボタンをクリックする`, '必要事項を入力して保存する', `追加した${lb}の削除ボタンをクリックする`]);
  }
  if (/空のまま.*モーダルが閉じない/.test(title))
    return steps([open, '「新規追加」ボタンをクリックする', '必須項目を空のまま保存ボタンをクリックする']);
  if (/遷移できる/.test(title)) {
    const m = title.match(/(.+?ページ)へ遷移できる/);
    return steps([open, m ? `「${m[1]}」リンクをクリックする` : 'ナビゲーションリンクをクリックする']);
  }
  if (/ドロップダウンで担当者を変更できる/.test(title))
    return steps([open, '担当者列のドロップダウンで担当者を変更する']);
  if (/ステータスドロップダウンで変更/.test(title))
    return steps([open, 'ステータス列のドロップダウンでステータスを変更する']);
  if (/クリックすると担当者で絞り込まれる/.test(title))
    return steps([open, 'スタッフカードをクリックする']);
  if (/再クリックすると絞り込みが解除される/.test(title))
    return steps([open, 'スタッフカードをクリックする', '同じスタッフカードを再度クリックする']);
  if (/リセット|全件に戻る/.test(title))
    return steps([open, 'フィルターを設定する', 'リセットボタンをクリックする']);
  if (/編集モーダル/.test(title))
    return steps([open, '任意の行の編集ボタンをクリックする']);
  if (/モーダル外クリック/.test(title))
    return steps([open, '「新規追加」ボタンをクリックする', 'モーダル外の領域をクリックする']);
  if (/「入金済に」ボタンで/.test(title))
    return steps([open, '未入金の行の「入金済に」ボタンをクリックする']);
  if (/未入金フィルター/.test(title)) return steps([open, '「未入金のみ」フィルターを選択する']);
  if (/入金済フィルター/.test(title))  return steps([open, '「入金済のみ」フィルターを選択する']);
  if (/緊急フィルター/.test(title))    return steps([open, '「緊急のみ」ボタンをクリックする']);
  return steps([open]);
}

// ===== 期待値 自動生成 =====
function generateExpectedValue(title) {
  if (/ページタイトルが正しい/.test(title))
    return '①正しいページタイトルが表示されている';
  if (/サイドバーナビゲーション/.test(title))
    return '①サイドバーに以下の5項目が表示されている\n・ダッシュボード\n・案件管理\n・担当管理\n・顧客管理\n・請求・入金管理';
  if (/KPIカードが4つ/.test(title))
    return '①以下の4つのKPIカードが表示されている\n・受注総額（契約済）\n・入金済合計\n・未入金残高\n・商談中・見込み額';
  if (/KPIカードに入金済・未入金・件数/.test(title))
    return '①以下のKPIカードが表示されている\n・入金済合計\n・未入金残高\n・請求件数合計';
  if (/各カードに氏名・稼働数・負荷ラベルが表示される/.test(title))
    return '①各カードに以下の情報が表示されている\n・氏名\n・稼働数\n・負荷ラベル（普通 / 多め / 要注意）';
  const rowItems = title.match(/各行に(.+?)が表示される/);
  if (rowItems) {
    const items = rowItems[1].split(/[・、]/);
    return `①各行に以下の項目が表示されている\n${items.map(i => '・' + i.trim()).join('\n')}`;
  }
  const summaryItems = title.match(/サマリーに(.+?)が表示される/);
  if (summaryItems) {
    const items = summaryItems[1].split(/[・、]/);
    return `①サマリーに以下の項目が表示されている\n${items.map(i => '・' + i.trim()).join('\n')}`;
  }
  if (/ドロップダウンが表示される/.test(title)) {
    const m = title.match(/各行に(.+?)ドロップダウンが表示される/);
    return m ? `①各行に${m[1]}ドロップダウンが表示されている` : '①各行にドロップダウンが表示されている';
  }
  if (/チャートcanvas/.test(title))
    return '①以下の3つのグラフが表示されている\n・案件ステータス分布\n・担当者別受注実績\n・工事種別別受注金額';
  const imp = title.match(/Excelから(\d+)件/);
  if (imp) return `①${imp[1]}件のデータが一覧に表示されている`;
  const fc = title.match(/フィルター[：:]\s*(.+?)\s*→\s*(\d+)件/);
  if (fc) return `①「${fc[1]}」のデータが${fc[2]}件表示されている`;
  const ff = title.match(/フィルター[：:]\s*(.+?)\s*→\s*(.+)/);
  if (ff) return `①「${ff[1]}」のデータのみ表示されている`;
  const ts = title.match(/テキスト検索[：:]\s*「(.+?)」/);
  if (ts) return `①「${ts[1]}」を含む行のみ表示されている`;
  if (/検索[：:].*絞り込み/.test(title))
    return '①入力したキーワードで絞り込まれたデータが表示されている';
  const tr = title.match(/(.+?ページ)へ遷移できる/);
  if (tr) return `①${tr[1]}へ遷移している`;
  const ad = title.match(/新規(.+?)の追加・削除ができる/);
  if (ad) return `①新規${ad[1]}が一覧に追加されている\n②追加した${ad[1]}が正常に削除されている`;
  if (/空のまま.*モーダルが閉じない/.test(title))
    return '①バリデーションエラーが表示されている\n②モーダルが閉じずに表示されたままになっている';
  if (/モーダル外クリックで閉じる/.test(title))
    return '①モーダルが閉じている';
  if (/編集モーダルに既存データが表示される/.test(title))
    return '①編集モーダルが開いている\n②既存のデータが各フィールドに正しく設定されている';
  if (/ドロップダウンで担当者を変更できる/.test(title))
    return '①選択した担当者に変更されている\n②変更内容が即座に保存されている';
  if (/ステータスドロップダウンで変更・即保存/.test(title))
    return '①ステータスが変更されている\n②変更内容が即座に保存されている';
  if (/トーストが表示される/.test(title))
    return '①操作完了のトースト通知が画面下部に表示されている';
  if (/稼働数が更新される/.test(title))
    return '①担当変更後、スタッフカードの稼働数が新しい値に更新されている';
  if (/入金ステータスが変わる/.test(title))
    return '①「入金済に」ボタン操作で入金ステータスが「入金済」に更新されている';
  if (/リセット|全件に戻る/.test(title))
    return '①フィルターがリセットされ全件が表示されている';
  if (/クリックすると担当者で絞り込まれる/.test(title))
    return '①クリックした担当者の案件のみ表示されている';
  if (/再クリックすると絞り込みが解除される/.test(title))
    return '①絞り込みが解除され全案件が表示されている';
  if (/ハイライトされている/.test(title))
    return '①期限超過の行が赤くハイライト表示されている';
  if (/APIと一致する/.test(title))
    return '①カードに表示される件数がAPIのレスポンス値と一致している';
  if (/件数バッジが/.test(title)) {
    const m = title.match(/(\d+)件/);
    return m ? `①緊急パネルの件数バッジに「${m[1]}」が表示されている` : '①件数バッジが表示されている';
  }
  if (/テーブルに行がある/.test(title))
    return '①一覧テーブルに1件以上のデータが表示されている';
  if (/ボタンが表示されない/.test(title))
    return '①該当行に「入金済に」ボタンが表示されていない';
  if (/未入金フィルター/.test(title)) return '①未入金のデータのみ表示されている';
  if (/入金済フィルター/.test(title))  return '①入金済のデータのみ表示されている';
  if (/緊急フィルター/.test(title))    return '①緊急フラグのある案件のみ表示されている';
  if (/受注総額が10,310,000円/.test(title))
    return '①受注総額が￥10,310,000と表示されている';
  if (/未入金残高が正の/.test(title))
    return '①未入金残高に正の金額が表示されている';
  if (/緊急アラートセクションが表示される/.test(title))
    return '①ダッシュボードに緊急アラートセクションが表示されている';
  if (/緊急案件（雨漏り）/.test(title))
    return '①緊急アラートに「雨漏り」の案件が表示されている';
  if (/色クラスが異なる/.test(title))
    return '①負荷レベルに応じてスタッフカードの色（クラス）が異なっている';
  if (/緊急タグがテーブルに表示される/.test(title))
    return '①緊急案件の行に緊急タグが表示されている';
  if (/緊急案件が先頭に並んでいる/.test(title))
    return '①緊急案件がテーブルの先頭行に表示されている';
  return `①${title}`;
}

// ===== テスト結果を平坦化 =====
function collectSpecs(node, filePath) {
  const results = [];
  const myFile  = node.file || filePath;
  if (node.specs) {
    for (const spec of node.specs) {
      const test      = spec.tests?.[0];
      const result    = test?.results?.[0];
      const fileName  = path.basename(myFile || '');
      const 検証結果  = test?.status === 'expected' ? '✅ 合格'
                      : test?.status === 'skipped'  ? '⏭️ スキップ'
                      : '❌ 失敗';
      const エラー内容 = result?.errors?.[0]?.message?.replace(/\n/g, ' ').slice(0, 300) || '';
      results.push({ fileName, title: spec.title, 検証結果, エラー内容 });
    }
  }
  if (node.suites) {
    for (const child of node.suites) results.push(...collectSpecs(child, myFile));
  }
  return results;
}

const newResults = [];
for (const suite of raw.suites || []) newResults.push(...collectSpecs(suite, ''));

// ===== 差分更新：既存は検証結果のみ更新、新規は全フィールド生成 =====
let maxNo = Math.max(0, ...Object.values(meta).map(m => m.no || 0));

for (const r of newResults) {
  const key      = `${r.fileName}::${r.title}`;
  const pageName = FILE_PAGE_MAP[r.fileName] || r.fileName.replace('.spec.ts', '');

  if (meta[key]) {
    // 既存：結果のみ更新
    meta[key].検証結果  = r.検証結果;
    meta[key].エラー内容 = r.エラー内容;
  } else {
    // 新規：全フィールドを自動生成
    maxNo++;
    meta[key] = {
      no:           maxNo,
      実施環境:    '開発',
      画面名:      pageName,
      テストユーザ: 'テストユーザ',
      テスト観点:  classifyPerspective(r.title),
      正常異常:    classify(r.title),
      操作:        generateOperation(r.title, pageName),
      期待値:      generateExpectedValue(r.title),
      検証結果:    r.検証結果,
      エラー内容:  r.エラー内容,
    };
  }
}

// メタデータを保存
fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf-8');

// ===== 集計 =====
const rows    = Object.values(meta).sort((a, b) => a.no - b.no);
const total   = rows.length;
const passed  = rows.filter(r => r.検証結果?.includes('合格')).length;
const failed  = rows.filter(r => r.検証結果?.includes('失敗')).length;
const skipped = rows.filter(r => r.検証結果?.includes('スキップ')).length;

const byPage = {};
for (const r of rows) {
  if (!byPage[r.画面名]) byPage[r.画面名] = { 合格: 0, 失敗: 0, スキップ: 0 };
  if (r.検証結果?.includes('合格'))     byPage[r.画面名].合格++;
  else if (r.検証結果?.includes('失敗')) byPage[r.画面名].失敗++;
  else                                   byPage[r.画面名].スキップ++;
}

// ===== MD 生成 =====
const now = new Date().toLocaleString('ja-JP');

// テーブルセルの改行を <br> に変換
function cell(text) {
  return (text || '').replace(/\n/g, '<br>');
}

const summaryTable = [
  '| テスト総数 | ✅ 合格 | ❌ 失敗 | ⏭️ スキップ | 合格率 |',
  '|:---:|:---:|:---:|:---:|:---:|',
  `| ${total} | ${passed} | ${failed} | ${skipped} | ${total > 0 ? Math.round(passed/total*100) : 0}% |`,
].join('\n');

const pageTable = [
  '| 画面名 | 合格 | 失敗 | スキップ |',
  '|:-------|:----:|:----:|:--------:|',
  ...Object.entries(byPage).map(([p, c]) => `| ${p} | ${c.合格} | ${c.失敗} | ${c.スキップ} |`),
].join('\n');

const tcHeader = [
  '| No | 実施環境 | 画面名 | テストユーザ | テスト観点 | 正常/異常 | 操作 | 期待値 | 検証結果 |',
  '|:--:|:--------:|:------:|:----------:|:---------:|:--------:|:-----|:-------|:-------:|',
].join('\n');

const tcRows = rows.map(r =>
  `| ${r.no} | ${r.実施環境} | ${r.画面名} | ${r.テストユーザ} | ${r.テスト観点} | ${r.正常異常} | ${cell(r.操作)} | ${cell(r.期待値)} | ${r.検証結果} |`
).join('\n');

const failedRows = rows.filter(r => r.検証結果?.includes('失敗'));
const failSection = failedRows.length === 0
  ? '> 失敗なし'
  : [
      '| No | 画面名 | 操作 | エラー内容 |',
      '|:--:|:------:|:-----|:-----------|',
      ...failedRows.map(r => `| ${r.no} | ${r.画面名} | ${cell(r.操作)} | ${r.エラー内容 || '—'} |`),
    ].join('\n');

const md = `# さくらリフォーム 販売管理システム — E2Eテストレポート

> 最終実行: ${now}

---

## サマリー

${summaryTable}

## 画面別集計

${pageTable}

---

## テストケース

<!-- TESTCASES:START -->
${tcHeader}
${tcRows}
<!-- TESTCASES:END -->

---

## ❌ 失敗一覧

${failSection}
`;

fs.writeFileSync(OUTPUT_PATH, md, 'utf-8');

console.log(`レポート出力完了: ${OUTPUT_PATH}`);
console.log(`  テスト総数: ${total} 件（うち新規追加: ${total - (Object.keys(meta).length - newResults.length)} 件）`);
console.log(`  ✅ 合格: ${passed} 件`);
console.log(`  ❌ 失敗: ${failed} 件`);
console.log(`  ⏭️ スキップ: ${skipped} 件`);
console.log(`  合格率: ${total > 0 ? Math.round(passed/total*100) : 0}%`);
