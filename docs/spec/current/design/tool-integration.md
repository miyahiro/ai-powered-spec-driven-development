# ツール・Git・検査スクリプト設計

入力: [ツール要件](../requirements/tool-integration.md)、[共通要件](../requirements/common.md)。

プラグインの仕様の出典: [VS Code の Agent plugins](https://code.visualstudio.com/docs/copilot/customization/agent-plugins)、[Agent plugin authoring reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference)、[Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)（2026-10-28 に確認）。

## DES-TOOL-001 環境と配置

| 項目 | 選択 |
| --- | --- |
| 対象 | VS Code Local の Copilot Chat（custom agents、agent skills、エージェントプラグイン（Preview）が使えること） |
| 配布 | エージェントプラグイン（Copilot 形式）。このリポジトリをマーケットプレイスにする |
| Node.js | 検査スクリプト用。標準モジュールだけを使い、依存は持たない（20 以上を想定） |
| Git | 状態の確認、ローカルのブランチ・コミット |
| MCP・専用サーバー・Spec Kit | 使わない |

```text
.github/
  plugin/
    marketplace.json                # マーケットプレイスの定義（plugins/sdd を指す）
  copilot-instructions.md           # このリポジトリの基本ルール（配布しない）
plugins/
  sdd/                              # プラグイン（配布物はこのフォルダーだけ）
    plugin.json                     # Copilot 形式のマニフェスト（name: sdd、version）
    common-rules.md                 # 共通ルール（全エージェントが最初に読む）
    README.md                       # 導入・管理ガイド
    user_guide.md                   # 利用者向けガイド
    agents/
      sdd-orchestrator.agent.md     # 窓口
      sdd-designer.agent.md         # 設計
      sdd-implementer.agent.md      # 実装
      sdd-reviewer.agent.md         # レビュー
    skills/<name>/SKILL.md          # 14の手順（必要なものは templates/ を持つ）
    skills/spec-check/scripts/
      check.mjs                     # 検査スクリプト
test/                               # 検査スクリプトとプラグインの構成のテスト（配布しない）
package.json                        # テストの実行用（依存なし、配布しない）
.gitignore                          # テストの一時ファイルなどを除く
```

`plugin.json` は `name`・`version`・`description`・`author`・`repository`・`license`・`keywords` だけを書き、`agents/` と `skills/` は既定の場所に置いて指定を省く。`marketplace.json` は `name`・`owner`・`plugins` を持ち、`plugins` の1件が `{"name": "sdd", "source": "./plugins/sdd", "version": …}` を指す。版は `plugin.json` とマーケットプレイスの項目で同じ値にし、配布する変更のたびに上げる。

共通ルールは、プラグインの部品に instructions がないため、`plugins/sdd/common-rules.md` の1つのファイルに置く。4つのエージェントは本文の冒頭に、共通ルールへの相対リンク（`../common-rules.md`）を付けて「作業の前に共通ルールを読む」と書く。リンク先が自動で読み込まれなくても、read で読めるようにするため。共通ルールの本文はこのファイルにだけ書き、エージェントやスキルに写さない。スキルを直接呼んだときは共通ルールを読まず、各スキルの手順に書いた範囲で守る（REQ-COM-006）。導入先の `.github/copilot-instructions.md` は、導入先が自分の基本ルールを書くファイルで、プラグインは触れない。

検査スクリプトは、検査の手順を持つ専用のスキル `spec-check` の中（`scripts/check.mjs`）に置く。スキル・エージェントの本文では `${PLUGIN_ROOT}` などの変数が展開されないため、他のスキルとエージェントはスクリプトのパスを書かず、`spec-check` の `SKILL.md` への相対リンク（`../skills/spec-check/SKILL.md` など）で参照する。`spec-check` は、自分の `SKILL.md` と同じフォルダーの `scripts/check.mjs` を、workspace のルートで実行する。

workspace の `.github/agents/`・`.github/skills/` に同じ名前のエージェント・スキルがあると、プラグインより優先される。このリポジトリには、プラグインの外にエージェント・スキルを置かない。

## DES-TOOL-002 Git の操作

| 操作 | 行う者 | 条件 |
| --- | --- | --- |
| `git status`、`git diff`、`git log` | AI | いつでも（読み取り） |
| `git init` | AI | 人の確認を得てから |
| `git switch -c <ブランチ>`、`git switch <ブランチ>` | AI | 受付・再開で、人の確認を得てから。未コミットの変更があって切り替えられない場合は選択肢を示す |
| `git add -- <パス>…`、`git commit -m …` | AI | 承認のとき（DES-WF-004）と、承認された範囲での作業の区切り。パスを必ず指定し、`git add -A`・`git add .`・`git commit -a` は使わない |
| push・PR・マージ・リベース・`reset --hard`・`--force`・履歴の書き換え・タグの削除 | 人 | AI は行わず、手順を案内する |

- ブランチ名は `change/<変更ID>` を推奨とする。
- コミットの前に `git status --short` で、案件の範囲外の変更が含まれないことを確かめる。

## DES-TOOL-003 検査スクリプト

`spec-check` スキルが、workspace のルートで `node <spec-check のフォルダー>/scripts/check.mjs [変更ID] [--json]` を実行する。検査するのは実行したフォルダー（`process.cwd()`）で、スクリプトの置き場所には依存しない。人は、インストール先のスクリプト（`~/.copilot/installed-plugins/<マーケットプレイス>/sdd/skills/spec-check/scripts/check.mjs`）を workspace のルートで直接実行してもよい。ファイルを書き換えず、Git は読み取りのコマンド（`log`・`diff`・`ls-files`・`branch`）だけを使う。

| 検査 | 対象 | 種別 |
| --- | --- | --- |
| ID の重複 | `docs/spec/current/requirements/` の表の先頭列の `REQ`・`NFR`・`AC`・`FUN` の ID、`docs/spec/current/design/` の `DES` の ID（見出しと表の先頭列） | エラー |
| 受入条件のない要件 | 要件の `REQ`・`NFR` のうち、どの受入条件の「対象」にも出てこないもの | エラー |
| リンク切れ | `docs/` と `.github/` の Markdown の相対リンク（ファイルと見出しのアンカー）。プラグインの中のリンクは、このリポジトリの構成のテストが同じ検査の関数で確かめる（DES-TOOL-006） | エラー |
| 状態ファイルの形式 | `docs/spec/changes/*/status.md` の frontmatter の項目と値、質問・承認の表の値（DES-SPEC-003） | エラー |
| タスク一覧の形式 | `docs/spec/changes/*/tasks.md` の状態の値 | エラー |
| 期限の来た質問 | 現在の工程までが期限の `open` の質問 | 警告 |
| 承認後の変更 | 承認の行ごとに、`approve(<工程>): <変更ID>` のコミットと今の作業ツリーの差分を対象のパスについて取り、変わったファイルや未追跡のファイルがあるか | 警告 |
| 承認のコミットがない | 承認の行に対応するコミットが見つからない | 警告 |

変更 ID を指定すると、その案件の要約（題名・規模・工程・状態・ブランチと今のブランチ・期限の来た質問・承認と再承認が必要な工程・タスクの件数・次の作業）も出す。`--json` で同じ内容を JSON で出す。

- 終了コードは、エラーがあれば 1、なければ 0。警告だけでは 0。
- 出力には、ファイルのパス・行・ID・質問の文と要点だけを含める。文書の本文は出さない。token・鍵などの秘密らしい文字列は伏せて出す。

## DES-TOOL-004 安全

- ターミナルの実行と編集は、Copilot / VS Code の標準の確認に従う。利用者がツールの自動承認を設定するかは利用者が決める。
- 独自の hook・ガード・隔離実行環境は持たない。AI に許す Git 操作は DES-TOOL-002 のとおりで、共通ルール（`common-rules.md`）とエージェントの指示で守る。
- 外部サービスへの書き込み、実際の購入・送信、本番の資格情報を使う操作はしない。テストは開発環境の中で行う。
- 既存の文書・コードの部分的な変更は、エディターの差分の編集で行う。

## DES-TOOL-005 導入と更新

1. VS Code で `chat.plugins.enabled` を有効にし、`chat.plugins.marketplaces` にこのリポジトリ（`<owner>/<repo>`）を登録する。
2. 拡張機能のビューの Agent Plugins から `sdd` をインストールする。
3. Copilot Chat で `sdd-orchestrator` を選び、依頼する。検査が動くことは「検査して」と頼んで確かめる（Node.js 20 以上が必要。依存のインストールは不要）。

- 更新は、プラグインの更新で行う。導入先の workspace のファイルは、導入でも更新でも変わらない。
- コピーでの導入と、コピーで入れた旧版からの移行の手順は扱わない。
- 導入先の `.github/agents/`・`.github/skills/` に同じ名前のエージェント・スキルがあるとプラグインより優先されるため、導入・管理ガイドに注意として書く。

## DES-TOOL-006 プラグインの開発と確認

- 開発する人は、`chat.pluginLocations` に `plugins/sdd` を登録し、このリポジトリでもプラグインを使って開発する。リポジトリにはプラグインの外のエージェント・スキルを置かないため、登録したプラグインがそのまま使われる。
- 今の配置からの移し方: プラグインは `.github/` の今のファイルを残したまま `plugins/sdd/` に写して作る。今のファイルが優先されて隠れるため、プラグインの動作は別の空の workspace に `plugins/sdd` を登録して確かめる。確かめた後、最後のタスクで `.github/agents/`・`.github/skills/`・`.github/instructions/`・`.github/sdd/` を消す。
- テストはリポジトリのルートで `npm test` を実行する（依存なし）。`test/check.test.mjs` は検査スクリプトを、`test/customization.test.mjs` はプラグインの構成を確かめる。
- 構成のテストで確かめること: `plugin.json` の `name` と、マーケットプレイスの項目の `source`・`version` の一致。4つのエージェントの名前・ツール・`user-invocable`・呼べる担当と、本文の冒頭の共通ルールへのリンク。14のスキルの名前と手順の形。共通ルールの必須の規則（push をしない、`git add -A` を使わない、承認のコミットの形）が `common-rules.md` にあること。`spec-check` 以外にスクリプトのパスが書かれていないこと。プラグインの中の Markdown のリンク切れ（検査スクリプトのリンクの検査の関数を、対象のフォルダーを変えて使う）。このリポジトリが自分の検査でエラーにならないこと。
- 検査スクリプトは、リンクの検査の関数を対象のフォルダーを引数で受け取る形にしてテストから使えるようにする。導入先での検査の対象（`docs/` と `.github/`）は変えない。
- VS Code での確認（エージェント・スキルが表示される、`tools`・`agents`・`user-invocable` が効く、共通ルールが読まれる、`spec-check` のスクリプトが相対パスで動く）は、手順と結果をタスク一覧に残す。

## 要件との対応

| 要件 | 設計 |
| --- | --- |
| REQ-TOOL-001 | DES-TOOL-001。 |
| REQ-TOOL-002 | DES-TOOL-002。 |
| REQ-TOOL-003 | DES-TOOL-004。 |
| REQ-TOOL-004 | DES-TOOL-004、DES-COM-007。 |
| REQ-TOOL-005 | DES-TOOL-001（`spec-check` の配置）、DES-TOOL-003。 |
| NFR-TOOL-001 | DES-TOOL-003。 |
| NFR-TOOL-002 | DES-SPEC-003、DES-TOOL-003。 |
| REQ-COM-005 | DES-TOOL-001、DES-TOOL-005。 |
| REQ-COM-006 | DES-TOOL-001（共通ルール）。 |
| REQ-COM-007 | DES-TOOL-006。 |
