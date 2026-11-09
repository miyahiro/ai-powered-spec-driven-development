# スペック駆動開発アシスタント 導入・管理ガイド

GitHub Copilot / VS Code で、アイデアから実装・検証までを、AI と対話しながらスペック駆動で進めるための仕組みです。個人や少人数のチームで、手軽に使えることを優先した「ライト版」です。VS Code のエージェントプラグイン `sdd` として配ります。

| 読む人 | 文書 |
| --- | --- |
| 導入・管理する人 | 本書 |
| 開発を進める利用者 | [ユーザーガイド](user_guide.md) |

## 1. 何が入っているか

| 配置（プラグインの中） | 内容 |
| --- | --- |
| `plugin.json` | プラグインのマニフェスト（Agent Plugins 1.0 の形式。名前 `sdd`、版） |
| `common-rules.md` | 全エージェントが作業の前に読む共通ルール |
| `com.github.copilot/agents/` | 4つのエージェント（窓口・設計・実装・レビュー） |
| `skills/` | 14の手順（受付、状況確認、質問、深掘り、承認、壁打ち、要件、外部設計、内部設計、影響の調査、タスク分解、TDD、レビュー、検査）とテンプレート |
| `skills/sdd-spec-check/scripts/check.mjs` | 検査スクリプト（読み取りだけ、依存なし） |

状態の管理に専用のランナーやデータベースは使いません。案件の状態は Markdown 1枚（`status.md`）に書き、承認は Git のローカルのコミットとして残します。操作の安全は、Copilot / VS Code の標準の確認（ターミナルの実行、ファイルの編集）に任せます。

## 2. 導入する

1. VS Code の設定で `chat.plugins.enabled` を有効にします（エージェントプラグインは Preview の機能です）。
2. `chat.plugins.marketplaces` に、このプラグインのリポジトリ（`miyahiro/ai-powered-spec-drivien-development`）を加えます。
3. 拡張機能のビューの Agent Plugins から `sdd` をインストールします。
4. 導入先の workspace を開き、Copilot Chat のエージェント選択に `sdd-orchestrator` が表示されることを確かめます。
5. `sdd-orchestrator` に「検査して」と頼み、検査が動くことを確かめます。Node.js 20 以上が必要です。依存のインストールは不要です。
6. Git のリポジトリでなければ、`git init` と最初のコミットをしておくと、承認の記録が使えます（受付で AI に頼むこともできます）。

導入で workspace のファイルは変わりません。`.github/copilot-instructions.md` は、導入先のプロジェクトの基本ルール（応答の言語、コーディング方針など）を書く場所として、そのまま使ってください。

workspace の `.github/agents/`・`.github/skills/` に、このプラグインと同じ名前のエージェント・スキル（`sdd-orchestrator`、`sdd-review` など）があると、そちらがプラグインより優先されます。同じ名前のエージェント・スキルを workspace に置かないでください。

これで使い始められます。利用者には [ユーザーガイド](user_guide.md) を案内してください。

## 3. AI に任せること・任せないこと

| 操作 | AI | 人 |
| --- | --- | --- |
| 文書・コードの編集、テストの実行 | 承認された範囲で行う（ホストの確認に従う） | 確認ダイアログで許可する |
| ブランチの作成・切り替え | 確認を得てから行う | 名前を確かめる |
| ローカルのコミット | 承認のときと作業の区切りに、パスを指定して行う | — |
| push・PR・マージ・リベース・履歴の書き換え | 行わない（手順を案内する） | 行う |
| 外部サービスへの書き込み、本番の操作 | 行わない | 必要なら行う |

ターミナルやファイル編集の自動承認（Copilot の設定）を使うかは、利用者の判断です。使わなければ、AI のコマンドは毎回確認ダイアログを通ります。

## 4. 検査スクリプト

普段は `sdd-orchestrator` に「検査して」「CHG-0001 の状況を教えて」と頼みます。CI などで人が直接実行するときは、workspace のルートで、インストール先のスクリプトを実行します。検査されるのは、実行したフォルダーです。

```sh
SDD_CHECK=~/.copilot/installed-plugins/spec-driven-development/sdd/skills/sdd-spec-check/scripts/check.mjs
node "$SDD_CHECK"                  # 全体の検査
node "$SDD_CHECK" CHG-0001         # 検査と、案件の状況の要約
node "$SDD_CHECK" CHG-0001 --json
```

インストール先のフォルダーは、VS Code とプラグインの入手方法によって変わることがあります。見つからなければ `sdd-orchestrator` に場所を聞いてください。

| 検査 | 種別 |
| --- | --- |
| 要件・受入条件・機能・設計の ID の重複 | エラー |
| 受入条件の「対象」に出てこない要件（`REQ`・`NFR`） | エラー |
| `docs/` と `.github/` の Markdown のリンク切れ（見出しのアンカーを含む） | エラー |
| `status.md` と `tasks.md` の書式・値の誤り | エラー |
| 期限の来た未解決の質問 | 警告 |
| 承認の後に対象のファイルが変わっている（再承認が必要） | 警告 |
| 承認の行に対応するコミットがない | 警告 |

- エラーがあると終了コード 1、なければ 0 です（警告だけなら 0）。
- ファイルは書き換えません。Git は `log`・`diff`・`ls-files`・`branch` の読み取りだけを使います。
- 出力に文書の本文は出さず、token や鍵らしい文字列は伏せます。

`status.md` と `tasks.md` の書き方は、テンプレート（[status.md](skills/sdd-change-intake/templates/status.md)、[tasks.md](skills/sdd-task-planning/templates/tasks.md)）にあります。主な値は次のとおりです。

| 項目 | 値 |
| --- | --- |
| `kind` | `new` / `enhancement` / `fix` |
| `size` | `standard` / `light` |
| `phase` | 標準: `ideation` / `requirements` / `design` / `implementation` / `done`。軽量: `outline` / `implementation` / `done` |
| `state` | `active` / `waiting-approval` / `blocked` / `paused` / `done` |
| 質問の期限 | 工程の値（`completion` も可）。状態は `open` / `resolved` |
| 承認の工程 | 標準: `requirements` / `design` / `completion`。軽量: `outline` / `completion` |
| タスクの状態 | `todo` / `doing` / `done` / `blocked` / `dropped` |

## 5. 運用

| いつ | 何をするか |
| --- | --- |
| この仕組みを新しい版に更新する | Agent Plugins から `sdd` を更新する。workspace のファイルは変わらない |
| 検査でエラーが出た | 表示されたファイルと行を直す。意味の確認はレビュー担当に頼む |

## 6. このプラグインを開発する

プラグインのリポジトリでは、`plugins/sdd/` がプラグインそのもので、`.github/plugin/marketplace.json` がマーケットプレイスの定義です。

1. VS Code のユーザーの設定（リモートでは Remote の設定）の `chat.pluginLocations` に、`plugins/sdd` の絶対パスを登録します（`true` で有効）。workspace の設定（`.vscode/settings.json`）には書けません。リポジトリにはプラグインの外のエージェント・スキルを置かないので、登録したプラグインがそのまま使われます。
2. リポジトリのルートで `npm test` を実行し、検査スクリプトとプラグインの構成（エージェント・スキル・共通ルールの配置と名前、版の一致、リンク切れ）を確かめます。依存のインストールは不要です。
3. 配布する変更では、`plugin.json` とマーケットプレイスの項目の `version` を同じ値に上げます。

## 7. 制約

- 承認の記録は、`status.md` の表とコミットの履歴です。本人認証・電子署名・改ざん防止の仕組みではありません。
- 手での編集と AI の編集を排他する仕組みはありません。同じファイルを同時に編集しないでください。変更は Git の差分で確かめられます。
- 独自の操作ガードはありません。AI の Git 操作の範囲は、共通ルールとエージェントの指示で守ります。スキルを直接指定したときは共通ルールが読まれず、各スキルの手順に書いた範囲だけが守られます。
- エージェントプラグインは VS Code の Preview の機能です。プラグインは Agent Plugins 1.0 の形式で、これを読めない古い VS Code ではエージェントが表示されません。その場合は VS Code を更新してください。役割の並行実行と MCP 連携は確認していません。Copilot の実際の環境での動作は、導入先で確かめてください。

以前のコピーで導入する版は Git の履歴（コミット 3666f64 以前）に、ランナー中心の仕組み（厳格版）はコミット 96e81d6 にあります。
