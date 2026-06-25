/**
 * README.md のフォルダツリーセクションを現在のディレクトリ構造に合わせて更新する。
 * Claude Code の PostToolUse フックから呼び出される。
 * マーカー <!-- TREE:START --> 〜 <!-- TREE:END --> の間だけを書き換える。
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const README_PATH = path.join(ROOT, 'README.md');
const MARKER_S    = '<!-- TREE:START -->';
const MARKER_E    = '<!-- TREE:END -->';

// ===== スキップ対象 =====
const SKIP_DIRS  = new Set(['node_modules', '.git', 'test-results', 'playwright-report']);
const SKIP_FILES = new Set(['package-lock.json', '.gitignore', '~$test-report.xlsx']);
// ルート直下のみスキップするファイル（移行前の残骸など）
const SKIP_ROOT_FILES = new Set(['test-report.xlsx']);
const SKIP_EXTS  = new Set(['.db-shm', '.db-wal']);

// ===== 日本語説明マッピング（相対パス → 説明 / ファイル名 → 説明）=====
const DESC = {
  // フォルダ（プロジェクトルートからの相対パス）
  'HandsOn_資料':             '元データ（Excel・PDF）',
  'data':                     'データベース（起動時に自動生成）',
  'db':                       'DB初期化スクリプト',
  'public':                   'フロントエンド（HTML・CSS・JS）',
  'routes':                   'バックエンドAPI',
  'tests':                    'E2Eテスト',
  'tests/レポート':            'テスト結果の出力先',
  'tests/レポート/html':       'PlaywrightのHTMLレポート',
  '.claude':                  'Claude Codeエージェント・フック設定',
  '.claude/agents':            'カスタムエージェント定義',
  // ファイル名
  'server.js':                'Expressサーバー 起動エントリポイント',
  'package.json':             '依存パッケージ定義',
  'playwright.config.ts':     'Playwright設定',
  'README.md':                'プロジェクト説明（自動更新）',
  'init.js':                  'テーブル定義・Excel取込処理',
  'api.js':                   'REST APIエンドポイント定義',
  'style.css':                '共通スタイルシート',
  'app.js':                   '共通UIスクリプト（カード折りたたみ等）',
  'index.html':               'ダッシュボード',
  'projects.html':            '案件管理',
  'assignment.html':          '担当管理',
  'customers.html':           '顧客管理',
  'invoices.html':            '請求・入金管理',
  'generate-report.js':       'テスト結果 → xlsx 変換スクリプト',
  'e2e-tester.md':            'E2Eテスト自動実行エージェント定義',
  'update-readme.js':         'README自動更新スクリプト',
  'settings.json':            'PostToolUseフック設定',
  'sakura.db':                'SQLiteデータベース本体',
  'playwright-results.json':  'Playwright実行結果（JSON）',
  'test-report.xlsx':         'テスト結果レポート（Excel）',
  'prompts.txt':              'プロンプト履歴',
};

function desc(relPath, name) {
  return DESC[relPath] || DESC[name] || '';
}

// ===== ディレクトリツリー生成 =====
function buildTree(dir, relBase = '', prefix = '', depth = 0) {
  if (depth > 4) return '';
  const isRoot = depth === 0;

  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return ''; }

  entries = entries.filter(e => {
    if (SKIP_DIRS.has(e.name))  return false;
    if (SKIP_FILES.has(e.name)) return false;
    if (isRoot && SKIP_ROOT_FILES.has(e.name)) return false;
    if (SKIP_EXTS.has(path.extname(e.name))) return false;
    // 隠しエントリは .claude のみ許可
    if (e.name.startsWith('.') && e.name !== '.claude') return false;
    return true;
  });

  // フォルダ優先、次いで日本語対応ソート
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, 'ja');
  });

  let out = '';
  for (let i = 0; i < entries.length; i++) {
    const e      = entries[i];
    const isLast = i === entries.length - 1;
    const conn   = isLast ? '└── ' : '├── ';
    const next   = prefix + (isLast ? '    ' : '│   ');
    const rel    = relBase ? `${relBase}/${e.name}` : e.name;
    const d      = desc(rel, e.name);
    const note   = d ? `  ← ${d}` : '';

    if (e.isDirectory()) {
      out += `${prefix}${conn}📂 ${e.name}/${note}\n`;
      out += buildTree(path.join(dir, e.name), rel, next, depth + 1);
    } else {
      out += `${prefix}${conn}${e.name}${note}\n`;
    }
  }
  return out;
}

// ===== README 更新 =====
function run() {
  let readme;
  try { readme = fs.readFileSync(README_PATH, 'utf-8'); }
  catch { return; } // README がなければ何もしない

  const si = readme.indexOf(MARKER_S);
  const ei = readme.indexOf(MARKER_E);
  if (si === -1 || ei === -1 || ei < si) return; // マーカーがなければスキップ

  const now  = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const tree = buildTree(ROOT);
  const block = [
    MARKER_S,
    `> 最終更新: ${now}`,
    '```',
    'TestApp01/',
    tree.trimEnd(),
    '```',
    MARKER_E,
  ].join('\n');

  const next = readme.slice(0, si) + block + readme.slice(ei + MARKER_E.length);
  if (next === readme) return; // 変更なしなら書き込まない

  try {
    fs.writeFileSync(README_PATH, next, 'utf-8');
    console.log(`[update-readme] README.md を更新しました (${now})`);
  } catch (err) {
    console.error('[update-readme] 書き込みエラー:', err.message);
  }
}

run();
