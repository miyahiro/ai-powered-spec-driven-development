---
id: CHG-0001
title: SDD の共通ルールを専用の instructions に移す
kind: enhancement
size: light
phase: done
state: done
approvers: 宮下 洋
branch:
---

# CHG-0001 SDD の共通ルールを専用の instructions に移す

## 目的と範囲

- 目的: SDD の共通ルールを導入先の `copilot-instructions.md` とぶつからない専用のファイルに移し、`copilot-instructions.md` を導入先のプロジェクトの基本ルール（応答の言語、コーディング方針など）の置き場として空ける。
- 対象: `.github/instructions/sdd.instructions.md` の新設と共通ルールの移動、このリポジトリの `copilot-instructions.md` の書き換え、配布設定のテスト、導入・管理ガイド、ツール設計（`tool-integration.md`）の実態との整合、`spec-driven-dev-summary.md` の削除と全面的な書き直し。
- 対象外: `applyTo` による読み込まれ方の確認（利用者が VS Code で行う）、コーディング方針の `coding.instructions.md` への分割、エージェント・スキルの手順の変更。

## 質問

| ID | 質問 | 選択肢・推奨 | 期限 | 状態 | 回答 |
| --- | --- | --- | --- | --- | --- |

## 承認

| 工程 | 日時 | 承認者 | 対象 |
| --- | --- | --- | --- |
| outline | 2026-10-27 | 宮下 洋 | docs/spec/current/requirements/common.md, docs/spec/changes/CHG-0001/outline.md |
| completion | 2026-10-28 | 宮下 洋 | .github/instructions/sdd.instructions.md, .github/copilot-instructions.md, .github/sdd/README.md, .github/sdd/test/customization.test.mjs, docs/spec/current/design/tool-integration.md, spec-driven-dev-summary.md, docs/spec/changes/CHG-0001/tasks.md |

## 次の作業

- なし（完了）。`main` で進めたため、push は人が行う。
