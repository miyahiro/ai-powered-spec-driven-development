---
id: CHG-0005
title: エージェントの置き場所を Agent Plugins 1.0 の形式に合わせる
kind: enhancement
size: light
phase: done
state: done
approvers: 宮下 洋
branch: change/CHG-0005
---

# CHG-0005 エージェントの置き場所を Agent Plugins 1.0 の形式に合わせる

## 目的と範囲

- 目的: プラグイン `sdd` は `plugin.json` に `$schema` がないため従来形式として読まれ、エージェントをルート直下の `agents/` に置いている。GitHub Docs（Copilot のプラグイン）と VS Code の Agent plugin reference が新しいプラグインに勧める Agent Plugins 1.0 の形式に合わせ、`plugin.json` に `$schema` を加え、エージェントを `com.github.copilot/agents/` に移す。
- 対象: `plugins/sdd/plugin.json`（`$schema` と version）、`plugins/sdd/agents/` の4つのエージェントの移動と本文の相対リンク、エージェントのパスを参照するスキル・共通ルール・README・ユーザーガイド、配布設定のテスト、今の仕様（`docs/spec/current/design/` の配置図と仕様の出典）、マーケットプレイスの version。
- 対象外: スキルの置き場所（1.0 でも `skills/` のまま）、エージェント・スキルの名前と工程の手順の変更、`commands/`・`rules/`・`hooks/`・`mcp.json`・`lsp.json` の追加、過去の変更記録（`docs/spec/changes/CHG-0001`・`CHG-0002`・`CHG-0004`）と `docs/idea/` の書き換え。
- 要件を変えない理由: 置き場所は配布の設計の決まりで、利用者から見た機能と受入条件は変わらない。決まりは設計 DES-TOOL-001 に書く。

## 質問

| ID | 質問 | 選択肢・推奨 | 期限 | 状態 | 回答 |
| --- | --- | --- | --- | --- | --- |

## 承認

| 工程 | 日時 | 承認者 | 対象 |
| --- | --- | --- | --- |
| outline | 2026-11-09 | 宮下 洋 | docs/spec/changes/CHG-0005/outline.md |
| completion | 2026-11-09 | 宮下 洋 | .github/plugin/marketplace.json, package.json, plugins/sdd/plugin.json, plugins/sdd/com.github.copilot/agents, plugins/sdd/README.md, plugins/sdd/user_guide.md, test/customization.test.mjs, docs/spec/current/design/tool-integration.md, docs/spec/changes/CHG-0005/tasks.md |

## 次の作業

- なし（完了）。push・PR・マージは人が行う。導入済みの利用者は、プラグインを 0.5.0 に更新すると、エージェントが `com.github.copilot/agents/` から読まれる。Agent Plugins 1.0 を読めない古い VS Code では、VS Code の更新が必要。
