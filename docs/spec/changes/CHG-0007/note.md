# CHG-0007 作業メモ

## 調べて分かった事実

- 検査スクリプトの front matter は `^([A-Za-z]+):` の行を読み、必須の8項目（`FRONTMATTER_KEYS`）の欠けだけをエラーにする。知らない項目（`guide` など）はエラーにならず、要約にも出ない（plugins/sdd/skills/sdd-spec-check/scripts/check.mjs の 15・64〜73・141 行）。
- 再承認の判定は承認の表の「対象」のパスだけの差分で行い、`status.md` は対象に入っていない（同 check.mjs 179〜186 行、docs/spec/changes/CHG-0006/status.md の承認の表）。
- リポジトリ版では `user_guide.md` は `.github/sdd/user_guide.md` に書き出され、リンクは書き換わる。導入・管理ガイド（README.md）へのリンクは URL になる（lib/repository-edition.mjs 11〜12 行、docs/spec/current/design/tool-integration.md の DES-TOOL-007 と 126 行）。
- スキルの数「14」は、design/tool-integration.md の 33・123 行、plugins/sdd/README.md の 17 行、test/customization.test.mjs の 74 行（テスト名）にもある。
- 受入確認計画の表は design/development-verification.md の DES-DEV-004 にあり、AC-WF-012 までしかない。
- ユーザーガイドの依頼の例は「4. 工程ごとの進め方」（要件・設計・実装の3つ）と「5. 途中で行うこと」の表にある。受付の後・壁打ちの合意の後・完了の承認の依頼の例はない（plugins/sdd/user_guide.md 151〜196 行）。

## テストや確認の方法

- 原本の検査: リポジトリのルートで `node plugins/sdd/skills/sdd-spec-check/scripts/check.mjs CHG-0007`（設計の編集後にエラー 0・警告 0）。

## 作業上の前提（未確認）

- plugins/sdd/README.md の 17 行と test/customization.test.mjs の 74 行のスキル数「14」は設計の範囲外のため直していない（実装で直す）。

## 実装で分かったこと（CHG-0007 実装）

- `npm test` の `the plugin manifest and the marketplace entry agree` は、`.github/plugin/marketplace.json` の version 0.6.1 と `plugins/sdd/plugin.json`・`package.json` の 0.6.0 の不一致で失敗する。実装の前の作業ツリーでも失敗し、コミット 0f8daa9（test）で marketplace.json が変わったもの。
- リポジトリ版のリンクの書き換えはアンカー（`#…`）を保つ（lib/repository-edition.mjs 37〜42 行）。`sdd-guide` からユーザーガイドの節へのリンクは `.github/skills/sdd-guide/` から `../../sdd/user_guide.md#…` になる。
- 見出しのアンカーは記号を除いて作られる（check.mjs の `slug`）。例: 「規模（標準と軽量）」→ `#規模標準と軽量`、「4. 工程ごとの進め方」→ `#4-工程ごとの進め方`。
- test/check.test.mjs の `status()` は、渡した項目をそのまま front matter に書くので、`status({ guide: 'on' })` で `guide` の行を作れる。
- `plugins/sdd/skills/sdd-spec-check/SKILL.md` の手順3の要約の項目の列挙には「手引き」がない（編集範囲外のため未変更）。

## テストや確認の方法（実装）

- 検査スクリプトの `guide` のテスト: `node --test test/check.test.mjs`。構成（スキル数・窓口の依頼表）: `node --test test/customization.test.mjs`。リポジトリ版のリンク: `node --test test/repository-edition.test.mjs`。
- 対話の試行の手順は tasks.md の TASK-8 にある（未実施）。
- 版を 0.7.0 に揃えた後は `npm test` が32件すべて成功する。版の番号は plugins/sdd/plugin.json・package.json・.github/plugin/marketplace.json のほか、plugins/sdd/README.md の 55・69・81 行（導入例のタグと版の表示例）にもある。docs/spec/current/design/tool-integration.md 178 行の version は記録の書式の例。
