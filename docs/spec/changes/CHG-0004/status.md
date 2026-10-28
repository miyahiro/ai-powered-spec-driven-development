---
id: CHG-0004
title: スキル名に sdd- を付けて他のスキルとぶつからないようにする
kind: enhancement
size: light
phase: done
state: done
approvers: 宮下 洋
branch:
---

# CHG-0004 スキル名に sdd- を付けて他のスキルとぶつからないようにする

## 目的と範囲

- 目的: プラグイン `sdd` のスキル名（`review`、`grill-me`、`clarification` など）が、エディタに最初からあるコマンドや他のプラグインのスキルと同じ名前になるのを避ける。すべてのスキル名に `sdd-` を付け、エージェント名（`sdd-designer` など）とそろえる。
- 対象: `plugins/sdd/skills/` の14個のスキルのフォルダ名と `SKILL.md` の `name`、スキル名を参照しているエージェント・スキル・共通ルール・README・ユーザーガイド、今の仕様（`docs/spec/current/`）、リポジトリの README と案内、配布設定のテスト、`plugin.json` の version（互換性のない変更として上げる）と名前が変わったことの案内。
- 対象外: 過去の変更記録（`docs/spec/changes/CHG-0001`・`CHG-0002`）と `docs/idea/` の書き換え、エージェント名の変更、エージェント・スキルの工程の手順の変更、旧名からの自動の移行。
- 要件を変えない理由: 名前の付け方は配布の設計の決まりで、利用者から見た機能と受入条件は変わらない。決まりは設計 DES-TOOL-001 に書く。

## 質問

| ID | 質問 | 選択肢・推奨 | 期限 | 状態 | 回答 |
| --- | --- | --- | --- | --- | --- |

## 承認

| 工程 | 日時 | 承認者 | 対象 |
| --- | --- | --- | --- |
| outline | 2026-10-28 | 宮下 洋 | docs/spec/changes/CHG-0004/outline.md |
| completion | 2026-10-28 | 宮下 洋 | plugins/sdd, test, README.md, package.json, .github/plugin/marketplace.json, docs/spec/current/design, docs/spec/changes/CHG-0004/tasks.md |
| completion | 2026-10-28 | 宮下 洋 | docs/spec/current/design/tool-integration.md, docs/spec/changes/CHG-0004/tasks.md |

## 次の作業

- なし（完了）。`main` で進めたため、push は人が行う。導入済みの利用者は、プラグインを更新すると新しい名前（`/sdd-review` など）で呼ぶことになる。
