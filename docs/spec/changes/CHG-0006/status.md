---
id: CHG-0006
title: エージェントとスキルを導入先リポジトリの .github/ に書き出せるようにする
kind: enhancement
size: standard
phase: done
state: done
approvers: 宮下 洋
branch: change/CHG-0006
---

# CHG-0006 エージェントとスキルを導入先リポジトリの .github/ に書き出せるようにする

## 目的と範囲

- 目的: エージェントプラグインは開発マシン（VS Code のユーザー設定）に紐づくため、リポジトリ単位でチームに適用できない。プラグイン `sdd` のエージェント・スキル・共通ルール・検査スクリプトを、導入先リポジトリの `.github/agents/`・`.github/skills/` などに書き出し、リポジトリにコミットするだけでチームの全員が使えるようにする。プラグインの中身は一つの元として保つ。
- 対象: 導入先の `.github/` への書き出し（導入・更新・状況の確認）を行うスクリプト、置き場所の違いによる相対リンクの書き換え、版と手で変えたファイルを判定する記録、`package.json` の実行の入口、導入・管理ガイドとユーザーガイド、テスト、今の仕様（`docs/spec/current/` の要件と設計）。
- 対象外: 工程の手順・エージェントとスキルの役割の変更、push・PR の自動化、導入先の `.github/copilot-instructions.md` の書き換え、GitHub のテンプレートリポジトリ・submodule による配布、過去の変更記録の書き換え。

## 質問

| ID | 質問 | 選択肢・推奨 | 期限 | 状態 | 回答 |
| --- | --- | --- | --- | --- | --- |
| Q-001 | プラグインでの配布を続けるか | 続ける（推奨。プラグイン開発と個人利用に使う）/ `.github/` 版だけにする | requirements | resolved | 続ける |
| Q-002 | 共通ルールと記録の書き出し先の名前 | `.github/sdd/`（推奨）/ `.github/instructions/` に置く / その他 | design | resolved | `.github/sdd/` |
| Q-003 | プラグインのスキルから導入する方法（「このリポジトリに導入して」）も用意するか | 用意しない（推奨。まずスクリプトだけ）/ 用意する | requirements | resolved | 用意しない |
| Q-004 | 実行するときの版の指定 | Git のタグ（`#v0.6.0`）/ ブランチ（`#main`）/ 両方を案内する（推奨。チームではタグを勧める） | design | resolved | タグとブランチのどちらでも指定できる |
| Q-005 | `.new` を取り込んだファイルの判定 | 今の内容が新しい版と同じなら取り込み済みとして記録を更新する（推奨）/ 取り込みを記録する操作も用意する | requirements | resolved | 新しい版と同じなら取り込み済み |
| Q-006 | 手で消したファイルを更新で戻すか | 戻さず一覧で示す（推奨）/ 新しい版で戻す | requirements | resolved | 戻さず一覧で示す |
| Q-007 | Git のリポジトリのルート以外で実行したときの扱い | ルートでなければ止める（推奨）/ どこでも実行できる | requirements | resolved | どこでも実行できる（実行したフォルダーに書き出す） |
| Q-008 | 同じ版・古い版を指定した更新 | 指定した版にそのまま合わせる（推奨）/ 古い版は止める | requirements | resolved | 指定した版にそのまま合わせる |
| Q-009 | `.new` を置いたときの記録の値（設計 DES-TOOL-008 の変更。実装で、R のままでは取り込んだ後も次の版で `.new` が置かれ続けると分かった） | 置いた版の内容（N）にする（推奨）/ R のままにし、取り込んだら同じ版でやり直す | implementation | resolved | 置いた版の内容（N）にする |
| Q-010 | 改行の違い（Windows の `core.autocrlf` による CRLF）を手で変えたものとして扱うか（設計 DES-TOOL-008 の変更。レビューで、CRLF になると更新のたびに全ファイルに `.new` が置かれると分かった） | 改行の違いを無視して判定する（推奨）/ ガイドで `.gitattributes` を案内する / 今回は直さない | implementation | resolved | 改行の違いを無視して判定する |

## 承認

| 工程 | 日時 | 承認者 | 対象 |
| --- | --- | --- | --- |
| requirements | 2026-11-09 | 宮下 洋 | docs/spec/current/requirements/common.md, docs/spec/current/requirements/tool-integration.md, docs/spec/current/requirements/README.md, docs/spec/changes/CHG-0006/idea.md |
| design | 2026-11-09 | 宮下 洋 | docs/spec/current/design/tool-integration.md, docs/spec/current/design/README.md |
| completion | 2026-11-09 | 宮下 洋 | bin/sdd.mjs, lib/repository-edition.mjs, package.json, test/repository-edition.test.mjs, test/customization.test.mjs, plugins/sdd/README.md, plugins/sdd/user_guide.md, README.md, plugins/sdd/plugin.json, .github/plugin/marketplace.json, docs/spec/current/design/tool-integration.md, docs/spec/changes/CHG-0006/tasks.md |
| completion | 2026-11-09 | 宮下 洋 | plugins/sdd/README.md, docs/spec/changes/CHG-0006/tasks.md |

## 次の作業

- なし（完了）。push・PR・マージは人が行う。マージの後、`v0.6.0` のタグを付けて push すると、リポジトリ版をタグで指定して導入できる（タグでの確認は未実施）。確かめていない範囲: Windows・macOS での実行、Copilot CLI・coding agent がリポジトリ版を読むか、古い npm（9 以下）での `npx github:`。
