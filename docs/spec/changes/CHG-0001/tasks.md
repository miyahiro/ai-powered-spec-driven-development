# CHG-0001 タスク一覧

状態: `todo` / `doing` / `done` / `blocked` / `dropped`。結果には、自動のテストならコマンドと結果の要点とコミット、手動の確認なら手順と観測した結果を書く。未実施は「未実施」と書く。

| ID | 内容 | 要件・受入条件 | 設計 | 確認方法 | 状態 | 結果 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-1 | 共通ルールの配置のテストを先に直す。範囲: `.github/sdd/test/customization.test.mjs`。完了の条件: 共通ルールを `instructions/sdd.instructions.md` から読み、`applyTo` があること、`copilot-instructions.md` に SDD のルールがないことを検査し、今の配置で意図どおり失敗する | REQ-COM-005、AC-COM-004 | — | TDD（`.github/sdd` で `npm test`） | done | Red: `npm test --prefix .github/sdd` で、`sdd.instructions.md` がない（ENOENT）ことと、`copilot-instructions.md` に `approve(<工程>)` が残っていることの2点で、意図どおり失敗（82c3ba6 の上で確認） |
| TASK-2 | 共通ルールを移す。範囲: `.github/instructions/sdd.instructions.md`（新規）、`.github/copilot-instructions.md`。完了の条件: 本文を中身を変えずに移して相対リンクを直し、`copilot-instructions.md` をこのリポジトリの基本ルールに書き換え、TASK-1 のテストが通る | REQ-COM-005、AC-COM-004 | — | TDD（`.github/sdd` で `npm test`）、`node .github/sdd/check.mjs` | done | Green: `npm test --prefix .github/sdd` 12 件成功・失敗 0。`node .github/sdd/check.mjs` エラー 0・警告 0。本文の差分は frontmatter と相対リンクだけ（`diff` で確認） |
| TASK-3 | 導入・管理ガイドを直す。範囲: `.github/sdd/README.md`。完了の条件: 配布物の表の共通ルールのパス、導入先の `copilot-instructions.md` を変えないこと、導入済みの workspace で古い共通ルールを取り除く手順が書かれている | REQ-COM-005、AC-COM-004 | — | レビュー、`node .github/sdd/check.mjs` | done | レビュー: 配布物の表、導入の手順、古い版からの更新の手順を追記。`check.mjs` エラー 0 |
| TASK-4 | ツール設計を実態に合わせる。範囲: `docs/spec/current/design/tool-integration.md`。完了の条件: 配置図（共通ルールの場所、スキル 13、`.gitignore`）、検査スクリプトの Git の読み取りコマンドと未追跡のファイル、共通ルールの場所、導入の手順が実態と一致する | REQ-COM-005 | DES-TOOL-001、DES-TOOL-003、DES-TOOL-004、DES-TOOL-005 | レビュー（`check.mjs`・`.github/` の実物と照合）、`node .github/sdd/check.mjs` | done | レビュー: `check.mjs` の Git の呼び出し（log・diff・ls-files・branch）、未追跡のファイルの検査、`.github/` の実物（スキル 13、`.gitignore`）と照合。`check.mjs` エラー 0 |
| TASK-5 | 構成の概要を書き直す。範囲: `spec-driven-dev-summary.md`（削除して新規に作る）。完了の条件: 今のエージェント 4・スキル 13・共通ルール・検査スクリプト・仕様の置き場所と工程の概要が実物と一致し、リンク切れがない | — | — | レビュー（`.github/` の実物と照合）、`node .github/sdd/check.mjs` | done | レビュー: エージェントの frontmatter とスキルへのリンク、スキルの description とテンプレート、`.github/sdd/` の実物と照合して全面的に書き直し。`check.mjs` エラー 0（リンク切れなし） |
