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
