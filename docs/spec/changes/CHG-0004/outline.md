# CHG-0004 要点

- 変える箇所: 要件は変えない（名前の付け方は配布の設計の決まりで、利用者から見た機能・受入条件は変わらないため）。設計 DES-TOOL-001（`docs/spec/current/design/tool-integration.md`）に名前の付け方を足し、配置図とスキル名を新しい名前にする。コードとガイドは、`plugins/sdd/skills/` の14個のフォルダー名と `SKILL.md` の `name`、スキルを参照するエージェント・スキル・テンプレート・`common-rules.md`・`README.md`・`user_guide.md`、`check.mjs` の使い方の表示、`docs/spec/current/design/` のスキル名、リポジトリの `README.md`、`test/` を変える。
- 方針: 14個のスキルすべての名前の先頭に `sdd-` を付ける（`change-intake` → `sdd-change-intake`、`review` → `sdd-review`、`spec-check` → `sdd-spec-check` など。残りも同じ規則）。かぶりやすい名前だけを変える案は、どれがかぶるかが導入先ごとに違い、エージェントの名前とそろわないため採らない。フォルダーは `git mv` で移し、履歴を残す。
- 影響: 工程の手順と中身は変えない。導入済みの利用者は、`/review` などの古い名前ではスキルを呼べなくなる。互換性がなくなるので、`plugin.json` とマーケットプレイスの version を 0.3.0 → 0.4.0 に上げる。新旧の名前の対応は README に書かない（利用者の判断）。過去の記録（`docs/spec/changes/CHG-0001`・`CHG-0002`、`docs/idea/`）は書き換えない。
- テスト: `test/customization.test.mjs` の期待するスキル名とパスを新しい名前に変え、すべてのスキル名が `sdd-` で始まることを検査に加える。新しい名前のテストが先に失敗することを確かめてから名前を変える。`npm test` と `node plugins/sdd/skills/sdd-spec-check/scripts/check.mjs` で、リンク切れを含めてエラーがないことを確かめる。古い名前が `docs/spec/changes/`・`docs/idea/` の外に残っていないことを `grep` で確かめる。
- 設計の文書: `docs/spec/current/design/tool-integration.md`（DES-TOOL-001 に名前の付け方を足す、配置図、DES-TOOL-003 と構成のテストの記述）、`workflow-orchestration.md`（DES-WF-003 のスキルの表など）、`specification-management.md`（テンプレートのパス）、`design/README.md`（対応表）のスキル名を変える。
