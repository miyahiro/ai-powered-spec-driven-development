# エージェントとスキルをプラグインとして配布する

入力・出所: 利用者の依頼（「作成したSDD用のAIエージェント及びスキルをプラグイン化したい」）と、確認フォームでの回答（`status.md` の Q-1〜Q-4、壁打ちでの回答）。VS Code の文書: [Agent plugins](https://code.visualstudio.com/docs/copilot/customization/agent-plugins)、[Agent plugin authoring reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference)。

## 目的と課題

- 事実: 今の導入は `.github/instructions/`・`.github/agents/`・`.github/skills/`・`.github/sdd/` を導入先へコピーする方法で、更新も差分を確かめてのコピーになる（当時の導入・管理ガイド `.github/sdd/README.md`）。
- 人の意向: エージェントとスキルをプラグインにまとめ、インストールで導入・更新できるようにしたい。

## 対象者・利用場面

- 導入する人: マーケットプレイス（このリポジトリ）を VS Code に登録し、`sdd` プラグインをインストールする。新しい版はプラグインの更新で入れる。
- 開発を進める利用者: 今までどおり Copilot Chat で `sdd-orchestrator` を選んで依頼する。
- この仕組みを開発する人: このリポジトリの `plugins/sdd/` をローカルのプラグインとして登録し、自分の開発にも使いながら確かめる。

## 候補比較

| 論点 | 候補 | 判断 |
| --- | --- | --- |
| 形式 | Copilot 形式 / Agent Plugins 1.0 / Claude Code も対象 | Copilot 形式。今の構成（`agents/`・`skills/`）をそのまま移せる |
| 導入の方法 | プラグインだけ / プラグインとコピーの両方 | プラグインだけ。2つの形を保つ手間を避ける |
| 共通ルール | 1つのファイルを各エージェントが参照 / 各エージェントの本文に入れる | 1つのファイルを参照。プラグインの部品に instructions がないため、`applyTo` の代わりにエージェントから読ませる |
| 検査スクリプト | 専用のスキルを新設 / `workflow-status` に置く | 専用のスキル `spec-check` に置き、他のスキル・エージェントはそのスキルへのリンクで参照する |
| リポジトリ内の配置 | `plugins/sdd/` とマーケットプレイスの定義 / リポジトリのルートをプラグインに | `plugins/sdd/`。`docs/` などを配布物に含めない |
| プラグイン名 | `sdd` / `spec-driven-development` | `sdd` |

## 採用案と理由

- 人の判断・出所: 上の表の判断はすべて利用者の回答による（`status.md` の Q-1〜Q-4 と、壁打ちでの確認フォームの回答）。
- 理由: インストールと更新だけで導入でき、配布物と導入先のファイルが重ならない。エージェント・スキルの名前と工程の手順は変えない。

## 提供する機能の概要

| 機能（仮称） | 誰が・何をできるか | 今回／将来 | 関係する既存の原本 | わかっているルール・未決 |
| --- | --- | --- | --- | --- |
| プラグインの導入と更新 | 導入する人が、マーケットプレイスを登録して `sdd` プラグインをインストール・更新すると、4つのエージェントと 14 のスキルが使える | 今回 | [tool-integration.md](../../current/requirements/tool-integration.md) | Copilot 形式。コピーでの導入は廃止 |
| 共通ルールの参照 | 4つのエージェントが、作業の前にプラグインの中の1つの共通ルールのファイルを読む | 今回 | [common.md](../../current/requirements/common.md) | 自動で読み込まれるかは未確認（Q-5）。スキルを直接呼んだときの扱いは Q-6 |
| 検査のスキル | 利用者とエージェントが `spec-check` スキルで、今の workspace の仕様と案件を検査し、案件の要約を見られる | 今回 | [tool-integration.md](../../current/requirements/tool-integration.md) | 検査の対象を、スクリプトの場所ではなく実行したフォルダーにする。人が直接実行する方法は Q-7 |
| 開発と確認 | この仕組みを開発する人が、`plugins/sdd/` をローカルのプラグインとして登録し、テストと VS Code での動作を確かめられる | 今回 | [development-verification.md](../../current/requirements/development-verification.md) | テストはプラグインの構成とリンクを確かめる |

## 対象範囲

- 今回の対象: `plugins/sdd/`（`plugin.json`、`agents/`、`skills/`、共通ルールのファイル）、マーケットプレイスの定義、`.github/agents/`・`.github/skills/`・`.github/instructions/`・`.github/sdd/` の移動と削除、検査スクリプトの検査対象の変更、テスト、2つのガイド、関係する要件・設計、`spec-driven-dev-summary.md`、`README.md`。
- 対象外: Agent Plugins 1.0・Claude Code の形式、コピーでの導入、コピーで入れた旧版からの移行の手順（利用者の判断で不要）、工程の手順の変更、公開のマーケットプレイスへの登録。
- 将来の候補: Agent Plugins 1.0 形式への移行（`rules/` で共通ルールを配れる可能性がある）。

## 前提・制約

- 確認済み: VS Code はプラグインの部品として、スキル・MCP・エージェント・hooks・コマンドを読み込む。instructions は部品にない。`${PLUGIN_ROOT}` が展開されるのは hooks と MCP の設定で、スキル・エージェントの本文での展開は文書に書かれていない（上の VS Code の文書）。
- 確認済み: `check.mjs` は、スクリプトの場所から2つ上を workspace として検査している（当時の `.github/sdd/check.mjs` の末尾）。呼び出しは1つのエージェントと5つのスキルにある。
- 仮説・未確認: プラグインのエージェントで `tools`・`agents`・`user-invocable` が今と同じように効くこと。スキルの中のスクリプトを、スキルからの相対パスで AI が実行できること。
- 品質面で気になること: エージェント・スキルの名前が、プラグイン名で修飾されて表示されるか（`sdd-orchestrator` を選ぶ操作が変わるか）。プラグインは Preview の機能で、`chat.plugins.enabled` が必要。

## 未解決質問

| 質問・参照 | 選択肢 | 推奨・理由 | 未確定の影響 | 確認期限の工程 |
| --- | --- | --- | --- | --- |
| Q-5 共通ルールを読ませる方法 | 相対リンクだけ / 本文に「最初に読む」と書き相対リンクも付ける | 後者。自動で読み込まれなくても確実に読める | エージェントの本文の書き方 | design |
| Q-6 スキルを直接呼んだときの共通ルール | エージェント経由だけで守る / 各スキルにも共通ルールへのリンクを置く | 前者。通常の入口は `sdd-orchestrator` で、14 のスキルに同じ参照を足す手間を避ける | 直接呼んだときに Git の操作の範囲などが守られない可能性 | requirements |
| Q-7 人が検査スクリプトを直接実行する方法 | エージェントに頼む / インストール先のパスを案内する / 両方 | 両方。普段は「状況を教えて」で足り、CI などではパスが要る | ガイドの書き方、要件 REQ-TOOL-005 の表現 | requirements |
| Q-8 このリポジトリのリンク検査の対象 | `docs/` と `.github/` のまま / `plugins/` も加える | `plugins/` も加える。プラグインのリンク切れを検査で見つけられる | `check.mjs` の検査対象 | design |
