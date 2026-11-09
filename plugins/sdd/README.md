# スペック駆動開発アシスタント 導入・管理ガイド

GitHub Copilot / VS Code で、アイデアから実装・検証までを、AI と対話しながらスペック駆動で進めるための仕組みです。個人や少人数のチームで、手軽に使えることを優先した「ライト版」です。VS Code のエージェントプラグイン `sdd` として配ります。チームで共有したいときは、同じ中身を導入先のリポジトリの `.github/` に書き出して（リポジトリ版）、リポジトリにコミットすることもできます。

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

リポジトリ版では、エージェントは `.github/agents/`、スキルは `.github/skills/`、共通ルールとユーザーガイドと記録（`manifest.json`）は `.github/sdd/` に置かれます。`plugin.json` と本書は書き出しません。

状態の管理に専用のランナーやデータベースは使いません。案件の状態は Markdown 1枚（`status.md`）に書き、承認は Git のローカルのコミットとして残します。操作の安全は、Copilot / VS Code の標準の確認（ターミナルの実行、ファイルの編集）に任せます。

## 2. 導入する

導入の方法は2つあります。

| 方法 | 向いている場面 | 更新 |
| --- | --- | --- |
| プラグイン | 個人で使う。自分のマシンの VS Code に入れる | Agent Plugins から更新する。workspace のファイルは変わらない |
| リポジトリ版 | チームで共有する。リポジトリにコミットすれば、全員がインストールなしに使える | 書き出しスクリプトの update を実行し、差分をコミットする |

### プラグインで導入する

1. VS Code の設定で `chat.plugins.enabled` を有効にします（エージェントプラグインは Preview の機能です）。
2. `chat.plugins.marketplaces` に、このプラグインのリポジトリ（`miyahiro/ai-powered-spec-drivien-development`）を加えます。
3. 拡張機能のビューの Agent Plugins から `sdd` をインストールします。
4. 導入先の workspace を開き、Copilot Chat のエージェント選択に `sdd-orchestrator` が表示されることを確かめます。
5. `sdd-orchestrator` に「検査して」と頼み、検査が動くことを確かめます。Node.js 20 以上が必要です。依存のインストールは不要です。
6. Git のリポジトリでなければ、`git init` と最初のコミットをしておくと、承認の記録が使えます（受付で AI に頼むこともできます）。

導入で workspace のファイルは変わりません。`.github/copilot-instructions.md` は、導入先のプロジェクトの基本ルール（応答の言語、コーディング方針など）を書く場所として、そのまま使ってください。

workspace の `.github/agents/`・`.github/skills/` に、このプラグインと同じ名前のエージェント・スキル（`sdd-orchestrator`、`sdd-review` など）があると、そちらがプラグインより優先されます。同じ名前のエージェント・スキルを workspace に置かないでください。

これで使い始められます。利用者には [ユーザーガイド](user_guide.md) を案内してください。

### リポジトリ版で導入する

Node.js 20 以上と Git（npx が GitHub からこのリポジトリを取得するため）が必要です。依存のインストールは不要です。

1. 導入先のリポジトリのルートで、版（Git のタグまたはブランチ）を指定して実行します。チームでは、同じ版を再現できるタグを勧めます。

   ```sh
   npx -y github:miyahiro/ai-powered-spec-drivien-development#v0.6.0 init    # タグを指定
   npx -y github:miyahiro/ai-powered-spec-drivien-development#main init      # ブランチを指定
   ```

2. 表示された一覧と `git status`・`git diff` で、書き出された内容を確かめます。書き出すのは `.github/agents/`・`.github/skills/`・`.github/sdd/` の中だけで、`.github/copilot-instructions.md` などほかのファイルは変わりません。
3. 同じ名前の既存のファイルがあったときは、上書きせずに隣に `<名前>.new` が置かれます。見比べて取り込み、`.new` を消します。
4. `.github/agents/`・`.github/skills/`・`.github/sdd/` をコミットします。記録の `.github/sdd/manifest.json` もコミットしてください。記録がないと、ほかの人が更新できません。
5. VS Code で開き直し、エージェント選択に `sdd-orchestrator` が表示されること、「検査して」で検査が動くことを確かめます。

| 操作 | コマンド（版の指定は init と同じ） | 内容 |
| --- | --- | --- |
| 更新 | `npx -y github:miyahiro/ai-powered-spec-drivien-development#<版> update` | 手で変えていないファイルを指定した版に置き換え、指定した版にないファイルを削除する。手で変えたファイルは上書き・削除せず、隣に `.new` を置く。古い版を指定すると、その版に戻る |
| 状況 | `npx -y github:miyahiro/ai-powered-spec-drivien-development#<版> status` | 記録の版と、手で変えた・手で消したファイルを示す。ファイルは変えない |

- 版は `0.6.0（3aa93b05e8f4）` のように、版の番号と内容の要約値で示します。ブランチを指定すると、同じ番号で中身が違うことがあるためです。
- `.new` の内容を取り込んで同じ内容にすると、次の更新からは手で変えていないものとして扱われます。取り込まずに残した変更は、次の更新でも守られます。
- スキルやエージェントを手で消すと、更新しても戻りません。ほかのファイルからのリンクが切れて、検査でエラーになることがあるため、使わないものも消さずに残すことを勧めます。消したものを戻したいときは、記録の `files` からその行を消して update を実行します。
- 取り除くときは、記録の `files` にあるファイルと `.github/sdd/` を消します。
- プラグインとリポジトリ版を両方入れると、リポジトリ版が使われます。

#### clone したリポジトリから導入する

GitHub から取得できないとき、または手元で中身を確かめてから書き出したいときは、clone したこのリポジトリのスクリプトを、導入先のリポジトリのルートで実行します。書き出す中身はスクリプトのある clone から読み、書き出し先は実行したフォルダーです。

```sh
git clone https://github.com/miyahiro/ai-powered-spec-drivien-development.git ~/sdd-src
git -C ~/sdd-src checkout v0.6.0      # 版は clone の側で切り替える

cd <導入先のリポジトリ>
node ~/sdd-src/bin/sdd.mjs init       # npx -y ~/sdd-src init でも同じ
```

- update と status も同じ書き方です（`node ~/sdd-src/bin/sdd.mjs update`）。確かめ方とコミットするものは、上の手順と同じです。
- 書き出すのは clone の作業ツリーの今の中身で、コミットしていない変更も含みます。チームで同じ版をそろえるときは、タグを checkout し、変更のない状態で実行してください。

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

インストール先のフォルダーは、VS Code とプラグインの入手方法によって変わることがあります。見つからなければ `sdd-orchestrator` に場所を聞いてください。リポジトリ版では、スクリプトは `.github/skills/sdd-spec-check/scripts/check.mjs` にあり、CI からもこのパスで実行できます。

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
| この仕組みを新しい版に更新する | プラグインは Agent Plugins から `sdd` を更新する（workspace のファイルは変わらない）。リポジトリ版は update を実行し、差分を確かめてコミットする |
| 検査でエラーが出た | 表示されたファイルと行を直す。意味の確認はレビュー担当に頼む |

## 6. このプラグインを開発する

プラグインのリポジトリでは、`plugins/sdd/` がプラグインそのもので、`.github/plugin/marketplace.json` がマーケットプレイスの定義です。`bin/sdd.mjs` と `lib/repository-edition.mjs` は、プラグインからリポジトリ版を作って書き出すスクリプトです。リポジトリ版の中身は書き出すときにプラグインから作るので、別に手で直すものはありません。このリポジトリ自身にはリポジトリ版を書き出しません。

1. VS Code のユーザーの設定（リモートでは Remote の設定）の `chat.pluginLocations` に、`plugins/sdd` の絶対パスを登録します（`true` で有効）。workspace の設定（`.vscode/settings.json`）には書けません。リポジトリにはプラグインの外のエージェント・スキルを置かないので、登録したプラグインがそのまま使われます。
2. リポジトリのルートで `npm test` を実行し、検査スクリプト、プラグインの構成（エージェント・スキル・共通ルールの配置と名前、版の一致、リンク切れ）、リポジトリ版の書き出し（置き場所、リンク、更新の判定）を確かめます。依存のインストールは不要です。
3. 配布する変更では、`plugin.json`・マーケットプレイスの項目・`package.json` の `version` を同じ値に上げます。リポジトリ版をタグで指定できるように、配布する版には `v<version>` のタグを付けて push します（人が行います）。

## 7. 制約

- 承認の記録は、`status.md` の表とコミットの履歴です。本人認証・電子署名・改ざん防止の仕組みではありません。
- 手での編集と AI の編集を排他する仕組みはありません。同じファイルを同時に編集しないでください。変更は Git の差分で確かめられます。
- 独自の操作ガードはありません。AI の Git 操作の範囲は、共通ルールとエージェントの指示で守ります。スキルを直接指定したときは共通ルールが読まれず、各スキルの手順に書いた範囲だけが守られます。
- エージェントプラグインは VS Code の Preview の機能です。プラグインは Agent Plugins 1.0 の形式で、これを読めない古い VS Code ではエージェントが表示されません。その場合は VS Code を更新してください。役割の並行実行と MCP 連携は確認していません。Copilot の実際の環境での動作は、導入先で確かめてください。

以前のコピーで導入する版は Git の履歴（コミット 3666f64 以前）に、ランナー中心の仕組み（厳格版）はコミット 96e81d6 にあります。
