# さくらリフォーム 販売管理システム

株式会社さくらリフォーム向けの社内販売管理 Web アプリケーションです。
Excel データを SQLite に取り込み、ブラウザから案件・顧客・請求・担当の管理を行います。

---

## フォルダ構成

<!-- TREE:START -->
> 最終更新: 2026/6/25 16:36:53
```
TestApp01/
├── 📂 .claude/  ← Claude Codeエージェント・フック設定
│   ├── 📂 agents/  ← カスタムエージェント定義
│   │   └── e2e-tester.md  ← E2Eテスト自動実行エージェント定義
│   ├── auto-commit.js
│   ├── settings.json  ← PostToolUseフック設定
│   └── update-readme.js  ← README自動更新スクリプト
├── 📂 data/  ← データベース（起動時に自動生成）
│   └── sakura.db  ← SQLiteデータベース本体
├── 📂 db/  ← DB初期化スクリプト
│   └── init.js  ← テーブル定義・Excel取込処理
├── 📂 HandsOn_資料/  ← 元データ（Excel・PDF）
│   ├── prompts.txt  ← プロンプト履歴
│   ├── スライド.pdf
│   ├── 案件管理表.xlsx
│   ├── 見積明細一覧.xlsx
│   ├── 顧客管理台帳.xlsx
│   ├── 工事サービス標準単価表.xlsx
│   ├── 社員名簿.xlsx
│   └── 請求・入金管理表.xlsx
├── 📂 public/  ← フロントエンド（HTML・CSS・JS）
│   ├── app.js  ← 共通UIスクリプト（カード折りたたみ等）
│   ├── assignment.html  ← 担当管理
│   ├── customers.html  ← 顧客管理
│   ├── index.html  ← ダッシュボード
│   ├── invoices.html  ← 請求・入金管理
│   ├── projects.html  ← 案件管理
│   └── style.css  ← 共通スタイルシート
├── 📂 routes/  ← バックエンドAPI
│   └── api.js  ← REST APIエンドポイント定義
├── 📂 tests/  ← E2Eテスト
│   ├── 📂 レポート/  ← テスト結果の出力先
│   │   ├── playwright-results.json  ← Playwright実行結果（JSON）
│   │   ├── test-report.md
│   │   └── testcases-meta.json
│   ├── assignment.spec.ts
│   ├── customers.spec.ts
│   ├── dashboard.spec.ts
│   ├── generate-report.js  ← テスト結果 → xlsx 変換スクリプト
│   ├── invoices.spec.ts
│   └── projects.spec.ts
├── CLAUDE.md
├── package.json  ← 依存パッケージ定義
├── playwright.config.ts  ← Playwright設定
├── README.md  ← プロジェクト説明（自動更新）
└── server.js  ← Expressサーバー 起動エントリポイント
```
<!-- TREE:END -->

---

## 起動方法

```bash
# 依存パッケージのインストール（初回のみ）
npm install

# サーバー起動
node server.js
# → http://localhost:3000 でアクセス可能
```

初回起動時に `HandsOn_資料/` の Excel ファイルを自動で読み込み、
`data/sakura.db` を作成します。2回目以降は既存 DB をそのまま使います。

---

## E2Eテスト

```bash
# テスト実行（サーバーが起動している状態で）
npx playwright test

# テスト結果レポートを生成（差分更新）
node tests/generate-report.js
# → tests/レポート/test-report.md に出力
```

テスト結果は `tests/レポート/` に保存されます。

---

## 技術スタック

| 区分 | 技術 |
|---|---|
| バックエンド | Node.js v24 + Express |
| データベース | SQLite（`node:sqlite` 組み込みモジュール） |
| フロントエンド | HTML / CSS / JavaScript（バニラ） |
| グラフ | Chart.js 4.4 |
| E2Eテスト | Playwright 1.61 + TypeScript |
| Excel読込 | xlsx パッケージ |
