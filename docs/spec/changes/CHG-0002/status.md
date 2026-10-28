---
id: CHG-0002
title: エージェントとスキルをプラグインとして配布する
kind: enhancement
size: standard
phase: design
state: active
approvers: 宮下 洋
branch: change/CHG-0002
---

# CHG-0002 エージェントとスキルをプラグインとして配布する

## 目的と範囲

- 目的: SDD のエージェント・スキル・検査スクリプトを VS Code のエージェントプラグイン（Copilot 形式）にまとめ、`.github/` へのコピーではなくプラグインのインストールで導入できるようにする。
- 対象: プラグインの構成（`plugin.json`、`agents/`、`skills/`）とこのリポジトリをマーケットプレイスにする設定、共通ルールの置き場の変更、検査スクリプトのスキルの中への移動と呼び出し方の変更、配布設定のテスト、導入・管理ガイドとユーザーガイド、ツール設計（`tool-integration.md`）と関係する要件、`spec-driven-dev-summary.md`。
- 対象外: Agent Plugins 1.0 形式・Claude Code 形式への対応、コピーによる導入の継続、コピーで入れた旧版からの移行の手順、エージェント・スキルの工程の手順の変更、公開のマーケットプレイスへの登録。

## 質問

| ID | 質問 | 選択肢・推奨 | 期限 | 状態 | 回答 |
| --- | --- | --- | --- | --- | --- |
| Q-1 | プラグインの形式はどれにするか | Copilot 形式（推奨）、Agent Plugins 1.0、Claude Code も対象 | requirements | resolved | Copilot 形式 |
| Q-2 | 導入の方法はどうするか | プラグインだけ（推奨）、プラグインとコピーの両方 | requirements | resolved | プラグインだけ |
| Q-3 | 共通ルールの置き場はどうするか | 1つのファイルを各エージェントが参照する、各エージェントの本文に入れる | design | resolved | 1つのファイルを作り、各エージェントから参照する（参照できる場合） |
| Q-4 | 検査スクリプトの置き場はどうするか | スキルの中、`sdd/` のまま | design | resolved | スキルの中に移す |
| Q-5 | 共通ルールをエージェントにどう読ませるか | 相対リンクだけ、本文に「最初に読む」と書き相対リンクも付ける（推奨） | design | open | |
| Q-6 | スキルを直接呼んだときの共通ルールをどうするか | エージェント経由だけで守る（推奨）、各スキルにもリンクを置く | requirements | resolved | エージェント経由だけで守る |
| Q-7 | 人が検査スクリプトを直接実行する方法 | エージェントに頼む、インストール先のパスを案内する、両方（推奨） | requirements | resolved | 両方 |
| Q-8 | このリポジトリのリンク検査の対象 | `docs/` と `.github/` のまま、`plugins/` も加える（推奨） | design | open | |

## 承認

| 工程 | 日時 | 承認者 | 対象 |
| --- | --- | --- | --- |
| requirements | 2026-10-28 | 宮下 洋 | docs/spec/current/requirements/common.md, docs/spec/current/requirements/tool-integration.md, docs/spec/current/requirements/README.md, docs/spec/changes/CHG-0002/idea.md |

## 次の作業

- 設計: `sdd-designer` に、`tool-integration.md`（DES-TOOL-001・003・005）と関係する設計（`workflow-orchestration.md` のエージェント・スキルの構成、`development-verification.md` の配布設定のテスト）を、プラグインの配置（`plugins/sdd/`、マーケットプレイス、共通ルールのファイル、`spec-check` スキル）に合わせて直してもらう。期限が design の Q-5・Q-8 を決める。
