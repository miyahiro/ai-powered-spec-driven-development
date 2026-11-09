# ツール・Git・検査スクリプト設計

入力: [ツール要件](../requirements/tool-integration.md)、[共通要件](../requirements/common.md)。

プラグインの仕様の出典: [VS Code の Agent plugins](https://code.visualstudio.com/docs/copilot/customization/agent-plugins)、[Agent plugin authoring reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference)、[Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)（2026-10-28 に確認）、[GitHub Copilot のプラグイン](https://docs.github.com/ja/copilot/concepts/customizations/plugins)、[Agent Plugins 1.0 のマニフェストのスキーマ](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json)（2026-11-09 に確認）。

## DES-TOOL-001 環境と配置

| 項目 | 選択 |
| --- | --- |
| 対象 | VS Code Local の Copilot Chat（custom agents、agent skills、エージェントプラグイン（Preview）が使えること） |
| 配布 | エージェントプラグイン（Agent Plugins 1.0 の形式）。このリポジトリをマーケットプレイスにする。プラグインから作るリポジトリ版を、書き出しスクリプトで導入先の `.github/` に書き出すこともできる（DES-TOOL-007） |
| Node.js | 検査スクリプトと書き出しスクリプト用。標準モジュールだけを使い、依存は持たない（20 以上を想定） |
| Git | 状態の確認、ローカルのブランチ・コミット |
| MCP・専用サーバー・Spec Kit | 使わない |

```text
.github/
  plugin/
    marketplace.json                # マーケットプレイスの定義（plugins/sdd を指す）
  copilot-instructions.md           # このリポジトリの基本ルール（配布しない）
plugins/
  sdd/                              # プラグイン（配布物はこのフォルダーだけ）
    plugin.json                     # Agent Plugins 1.0 のマニフェスト（$schema、name: sdd、version）
    common-rules.md                 # 共通ルール（全エージェントが最初に読む）
    README.md                       # 導入・管理ガイド
    user_guide.md                   # 利用者向けガイド
    com.github.copilot/agents/      # Copilot 固有の部品（他のクライアントは読まない）
      sdd-orchestrator.agent.md     # 窓口
      sdd-designer.agent.md         # 設計
      sdd-implementer.agent.md      # 実装
      sdd-reviewer.agent.md         # レビュー
    skills/<name>/SKILL.md          # 14の手順（name は sdd- で始まる。必要なものは templates/ を持つ）
    skills/sdd-spec-check/scripts/
      check.mjs                     # 検査スクリプト
bin/
  sdd.mjs                           # 書き出しスクリプトの入口（init / update / status。DES-TOOL-007）
lib/
  repository-edition.mjs            # リポジトリ版の組み立て、更新の判定と書き込み（DES-TOOL-007・008）
test/                               # 検査スクリプト・プラグインの構成・書き出しのテスト（配布しない）
package.json                        # テストの実行用と、npx の入口（bin・files。依存なし）
.gitignore                          # テストの一時ファイルなどを除く
```

`plugin.json` は `$schema`（`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`）・`name`・`version`・`description`・`author`・`repository`・`license`・`keywords` だけを書く。`$schema` があると Agent Plugins 1.0 として読まれ、ないと従来形式（エージェントはルート直下の `agents/`）として読まれる。新しいプラグインには 1.0 が勧められており、スキルを他のクライアントと共有できるため 1.0 にする。1.0 では、スキルは標準の場所 `skills/` に、エージェントは Copilot 固有の部品として `com.github.copilot/agents/` に置く。1.0 を読めない古いクライアントではエージェントが見つからないため、導入・管理ガイドに注意として書く。`marketplace.json` は `name`・`owner`・`plugins` を持ち、`plugins` の1件が `{"name": "sdd", "source": "./plugins/sdd", "version": …}` を指す。版は `plugin.json` とマーケットプレイスの項目で同じ値にし、配布する変更のたびに上げる。

共通ルールは、プラグインの部品に instructions がないため、`plugins/sdd/common-rules.md` の1つのファイルに置く。4つのエージェントは本文の冒頭に、共通ルールへの相対リンク（`../../common-rules.md`）を付けて「作業の前に共通ルールを読む」と書く。リンク先が自動で読み込まれなくても、read で読めるようにするため。共通ルールの本文はこのファイルにだけ書き、エージェントやスキルに写さない。スキルを直接呼んだときは共通ルールを読まず、各スキルの手順に書いた範囲で守る（REQ-COM-006）。導入先の `.github/copilot-instructions.md` は、導入先が自分の基本ルールを書くファイルで、プラグインは触れない。

検査スクリプトは、検査の手順を持つ専用のスキル `sdd-spec-check` の中（`scripts/check.mjs`）に置く。スキル・エージェントの本文では `${PLUGIN_ROOT}` などの変数が展開されないため、他のスキルとエージェントはスクリプトのパスを書かず、`sdd-spec-check` の `SKILL.md` への相対リンク（エージェントからは `../../skills/sdd-spec-check/SKILL.md`、スキルからは `../sdd-spec-check/SKILL.md`）で参照する。`sdd-spec-check` は、自分の `SKILL.md` と同じフォルダーの `scripts/check.mjs` を、workspace のルートで実行する。

エージェントとスキルの名前（スキルはフォルダー名と `SKILL.md` の `name`）は、先頭に `sdd-` を付ける（`sdd-orchestrator`、`sdd-review` など）。`review` のようなよくある名前は、エディターに最初からあるコマンドや他のプラグインのスキルと同じ名前になりやすく、どれが呼ばれるか分からなくなるため。利用者の呼びかけの言葉（「grill-me して」など）は名前ではないので、付けない。

workspace の `.github/agents/`・`.github/skills/` に同じ名前のエージェント・スキルがあると、プラグインより優先される。このリポジトリには、プラグインの外にエージェント・スキルを置かず、リポジトリ版も書き出さない（このリポジトリはプラグインで開発する）。

プラグインの中の文書（共通ルール・ユーザーガイド・エージェント・スキル）は、プラグインとリポジトリ版のどちらで読まれても意味が通るように書く。「プラグインの共通ルール」のように配り方を決めつける書き方をせず、置き場所の違いは相対リンクで吸収する（リンクは書き出しのときに書き換える。DES-TOOL-007）。

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

`sdd-spec-check` スキルが、workspace のルートで `node <sdd-spec-check のフォルダー>/scripts/check.mjs [変更ID] [--json]` を実行する。検査するのは実行したフォルダー（`process.cwd()`）で、スクリプトの置き場所には依存しない。人は、インストール先のスクリプト（プラグインでは `~/.copilot/installed-plugins/<マーケットプレイス>/sdd/skills/sdd-spec-check/scripts/check.mjs`、リポジトリ版では `.github/skills/sdd-spec-check/scripts/check.mjs`）を workspace のルートで直接実行してもよい。ファイルを書き換えず、Git は読み取りのコマンド（`log`・`diff`・`ls-files`・`branch`）だけを使う。

| 検査 | 対象 | 種別 |
| --- | --- | --- |
| ID の重複 | `docs/spec/current/requirements/` の表の先頭列の `REQ`・`NFR`・`AC`・`FUN` の ID、`docs/spec/current/design/` の `DES` の ID（見出しと表の先頭列） | エラー |
| 受入条件のない要件 | 要件の `REQ`・`NFR` のうち、どの受入条件の「対象」にも出てこないもの | エラー |
| リンク切れ | `docs/` と `.github/` の Markdown の相対リンク（ファイルと見出しのアンカー）。プラグインの中のリンクは、このリポジトリの構成のテストが同じ検査の関数で確かめる（DES-TOOL-006）。導入先のリポジトリ版も `.github/` にあるため、ここで検査される（`<名前>.new` は `.md` で終わらないので対象外） | エラー |
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

- 更新は、プラグインの更新で行う。プラグインで導入したときは、導入先の workspace のファイルは、導入でも更新でも変わらない。
- 手でのコピーによる導入と、コピーで入れた旧版からの移行の手順は扱わない。リポジトリ版の導入と更新は DES-TOOL-007・008 で行う。
- 導入先の `.github/agents/`・`.github/skills/` に同じ名前のエージェント・スキルがあるとプラグインより優先されるため、導入・管理ガイドに注意として書く。プラグインとリポジトリ版を両方入れると、リポジトリ版が使われる。

リポジトリ版で導入するときの導入・管理ガイドの手順:

1. 導入先のリポジトリのルートで `npx -y github:<owner>/<repo>#<タグまたはブランチ> init` を実行する（例: `#v0.6.0`、`#main`）。Node.js 20 以上と Git（npx が GitHub から取得するため）が要る。チームでは、同じ版を再現できるタグを勧める。
2. 示された一覧と `git status`・`git diff` で、書き出された内容を確かめる。`.new` が置かれたら、同じ名前の既存のファイルと見比べて取り込む。
3. `.github/agents/`・`.github/skills/`・`.github/sdd/`（記録の `manifest.json` を含む）をコミットする。記録をコミットしないと、他の人が更新できない。
4. 更新は `… #<版> update`、入れた版と手で変えたファイルの確認は `… status` で行う。

- `.new` の内容を取り込んだら、`.new` は人が消す。
- スキルやエージェントを手で消すと、他のファイルからのリンクが切れ、検査でエラーになることがある（Q-006 の答えにより、更新でも戻さない）。使わないものは消さずに残すことを勧める。消したものを戻したいときは、記録の `files` からその行を消して update を実行する。
- 取り除くときは、記録の `files` にあるファイルと `.github/sdd/` を人が消す。

## DES-TOOL-006 プラグインの開発と確認

- 開発する人は、`chat.pluginLocations` に `plugins/sdd` を登録し、このリポジトリでもプラグインを使って開発する。リポジトリにはプラグインの外のエージェント・スキルを置かないため、登録したプラグインがそのまま使われる。
- 今の配置からの移し方: プラグインは `.github/` の今のファイルを残したまま `plugins/sdd/` に写して作る。今のファイルが優先されて隠れるため、プラグインの動作は別の空の workspace に `plugins/sdd` を登録して確かめる。確かめた後、最後のタスクで `.github/agents/`・`.github/skills/`・`.github/instructions/`・`.github/sdd/` を消す。
- テストはリポジトリのルートで `npm test` を実行する（依存なし）。`test/check.test.mjs` は検査スクリプトを、`test/customization.test.mjs` はプラグインの構成を確かめる。
- 構成のテストで確かめること: `plugin.json` の `$schema` が Agent Plugins 1.0 の値であること、`name` と、マーケットプレイスの項目の `source`・`version` の一致。4つのエージェントが `com.github.copilot/agents/` にあり、ルート直下に `agents/` がないこと、エージェントの名前・ツール・`user-invocable`・呼べる担当と、本文の冒頭の共通ルールへのリンク。14のスキルの名前（先頭が `sdd-`）と手順の形。共通ルールの必須の規則（push をしない、`git add -A` を使わない、承認のコミットの形）が `common-rules.md` にあること。`sdd-spec-check` 以外にスクリプトのパスが書かれていないこと。プラグインの中の Markdown のリンク切れ（検査スクリプトのリンクの検査の関数を、対象のフォルダーを変えて使う）。このリポジトリが自分の検査でエラーにならないこと。
- 検査スクリプトは、リンクの検査の関数を対象のフォルダーを引数で受け取る形にしてテストから使えるようにする。導入先での検査の対象（`docs/` と `.github/`）は変えない。
- VS Code での確認（エージェント・スキルが表示される、`tools`・`agents`・`user-invocable` が効く、共通ルールが読まれる、`sdd-spec-check` のスクリプトが相対パスで動く）は、手順と結果をタスク一覧に残す。
- 書き出しのテスト（`test/repository-edition.test.mjs`）で確かめること: リポジトリ版のすべてのパスが `.github/agents/`・`.github/skills/`・`.github/sdd/` の中にあること。一時フォルダーに init し、検査スクリプトのリンクの検査（対象 `.github`）でエラーがないこと。導入・管理ガイドへのリンクが URL になっていること。`.github/copilot-instructions.md` と置き場所の外のファイルが変わらないこと。init を2回実行すると2回目は何も書かずに止まること。DES-TOOL-008 の判定表のすべての行（版の内容を書き換えた模擬の新しい版で update する）。status がファイルを変えないこと。
- 構成のテストで、`package.json` の `bin`・`files` と、`plugin.json` の `repository` があることを確かめる。
- 書き出し・更新の実際の確認（`npx github:` でタグとブランチを指定して空のリポジトリに init し、プラグインを入れていない VS Code で `sdd-orchestrator` が表示され、受付と検査が動く。AC-COM-011）は、手順と結果をタスク一覧に残す。

## DES-TOOL-007 リポジトリ版の書き出し

書き出しスクリプトは、このリポジトリのルートの `bin/sdd.mjs`（入口）と `lib/repository-edition.mjs`（処理）に置く。プラグインの外に置くのは、プラグインを入れた人には要らない道具で、プラグインの配布物に含めないため。`package.json` に `"bin": {"sdd": "bin/sdd.mjs"}` と `"files": ["bin", "lib", "plugins"]` を書く。npx は bin が1つのパッケージではそれを実行するため、`npx -y github:<owner>/<repo>#<ref> <操作>` で動く。`#<ref>` には Git のタグとブランチのどちらも書ける（npx が取得する）。

```text
sdd init     実行したフォルダーにリポジトリ版を書き出す
sdd update   実行したフォルダーのリポジトリ版を、実行した版に合わせる（DES-TOOL-008）
sdd status   記録の版と、手で変えた・消したファイルを示す（ファイルを変えない）
```

| 場合 | 動き | 終了コード |
| --- | --- | --- |
| init・update が書き終えた、status | 一覧を示す | 0 |
| init で記録（`.github/sdd/manifest.json`）がすでにある | 何も書かずに、update を案内する | 1 |
| update・status で記録がない | 何も書かずに、init を案内する | 1 |
| 操作がない・知らない操作 | 使い方を示す | 2 |
| 書き込みの途中で失敗した | 失敗したパスと理由を示す。記録は最後に書くため、同じ操作をやり直せば続きから整う | 1 |

- 書き出し先は `process.cwd()`。Git のリポジトリかは確かめない（Q-007）。導入先の Git を操作しない。
- 版は、取得したプラグインの `plugin.json` の `version`。ブランチを指定すると同じ `version` で内容が違うことがあるため、記録と出力には版に加えて、リポジトリ版の全体の要約値（各ファイルのパスとハッシュを並べた sha256 の先頭12文字）を示す。

書き出すファイル（プラグインの `plugins/sdd/` から）:

| プラグインの中 | 書き出し先 |
| --- | --- |
| `com.github.copilot/agents/<名前>.agent.md` | `.github/agents/<名前>.agent.md` |
| `skills/**`（テンプレート・`scripts/check.mjs` を含む） | `.github/skills/**` |
| `common-rules.md` | `.github/sdd/common-rules.md` |
| `user_guide.md` | `.github/sdd/user_guide.md` |
| `plugin.json`・`README.md` | 書き出さない |

リンクの書き換え: Markdown のファイルごとに、検査スクリプトのリンクの検査（DES-TOOL-003）と同じ規則（コードのフェンスとインラインのコードの外の `[…](…)`、`http:`・`https:`・`mailto:` と `#` だけのものは対象外）でリンクを探す。リンク先をプラグインの中のパスに解決し、次のように書き換える。アンカー（`#…`）はそのまま残す。

| リンク先 | 書き換え |
| --- | --- |
| 上の表で書き出すファイル | 書き出し先のファイルから、リンク先の書き出し先への相対パス（スキル同士の `../sdd-x/SKILL.md` は、結果として同じ文字列になる） |
| `README.md`（導入・管理ガイド） | `<plugin.json の repository>/blob/main/plugins/sdd/README.md` |
| それ以外（プラグインの外など） | 書き出しを止め、エラーにする（書き出しのテストで見つける） |

テキスト以外の書き換えはしない。`.md` 以外のファイル（`check.mjs` など）はそのまま写す。

## DES-TOOL-008 記録と更新の判定

記録は `.github/sdd/manifest.json` に置く（Q-002）。

```json
{
  "plugin": "sdd",
  "version": "0.6.0",
  "digest": "3f9a1c0b7e2d",
  "repository": "https://github.com/<owner>/<repo>",
  "files": {
    ".github/agents/sdd-orchestrator.agent.md": "sha256-<書き出した内容のハッシュ>"
  }
}
```

- `files` のキーは導入先のルートからのパス（`/` 区切り）、値は書き出した内容（リンクの書き換えの後）の sha256。記録そのものは `files` に入れない。
- 「手で変えた」は、今のファイルの内容のハッシュが記録の値とも、実行した版の内容とも違うこと。ハッシュは改行の CRLF を LF にそろえてから取り、Git が取り出すときに変えた改行は変更として扱わない（Q-010。Windows の `core.autocrlf` で CRLF になっても、更新のたびに `.new` が置かれないようにする）。書き出す内容は LF のまま。
- `.new` を置いたときは、記録の値を置いた版の内容（N）にする（Q-009）。人が `.new` を取り込めば、次の更新では記録と同じ内容として置き換わり、取り込まなければ記録と違うため引き続き守られる。

init は、記録が空の update として同じ判定で行う。各パスについて、記録の値（R）・実行した版の内容（N）・今のファイル（C）で決める。

| R | N | C | 動き | 記録 | 一覧の区分 |
| --- | --- | --- | --- | --- | --- |
| なし | あり | なし | N を書く | N | 追加 |
| なし | あり | N と同じ | 何もしない | N | — |
| なし | あり | N と違う | 書かずに `<パス>.new` に N を書く | N | `.new` を置いた（既存のファイル） |
| あり | あり | R と同じ | N を書く（N と R が同じなら何もしない） | N | 置き換え |
| あり | あり | N と同じ | 何もしない（`.new` を取り込み済み。Q-005） | N | — |
| あり | あり | R・N と違う | 書かずに `<パス>.new` に N を書く | N | `.new` を置いた（手で変えた） |
| あり | あり | なし | 書かない（Q-006） | R のまま | 手で消した |
| あり | なし | R と同じ | 消す | 消す | 削除 |
| あり | なし | R と違う | 消さない | 消す | 手で変えたため残した |
| あり | なし | なし | 何もしない | 消す | — |

- 記録にないファイル（上の表に出てこないパス）は、読まず、消さない。書き込み・削除は `.github/agents/`・`.github/skills/`・`.github/sdd/` の中に限り、外のパスになる場合は止める（NFR-COM-007）。
- 削除で空になったフォルダーは、`.github/skills/` の下に限り消す。
- `<パス>.new` がすでにあれば上書きする。それ以外の `.new` は残す（取り込んだ後に人が消す）。
- 書き込みの順は、ファイル → 記録。記録の `version`・`digest` は実行した版の値にする。
- update は記録の版より新しいか古いかを判断しない（Q-008）。出力の先頭に「記録の版（要約値）→ 実行した版（要約値）」を示す。
- 出力は区分ごとのパスの一覧と、最後に「`git status` と `git diff` で確かめてからコミットしてください」の案内。status は、記録の版と要約値、手で変えた・手で消したファイル、実行したスクリプトの版を示す。

## 要件との対応

| 要件 | 設計 |
| --- | --- |
| REQ-TOOL-001 | DES-TOOL-001。 |
| REQ-TOOL-002 | DES-TOOL-002。 |
| REQ-TOOL-003 | DES-TOOL-004。 |
| REQ-TOOL-004 | DES-TOOL-004、DES-COM-007。 |
| REQ-TOOL-005 | DES-TOOL-001（`sdd-spec-check` の配置）、DES-TOOL-003。 |
| NFR-TOOL-001 | DES-TOOL-003。 |
| NFR-TOOL-002 | DES-SPEC-003、DES-TOOL-003。 |
| REQ-COM-005 | DES-TOOL-001、DES-TOOL-005、DES-TOOL-007。 |
| REQ-COM-006 | DES-TOOL-001（共通ルール）。 |
| REQ-COM-007 | DES-TOOL-006。 |
| REQ-COM-008 | DES-TOOL-005（ガイドの手順）、DES-TOOL-007。 |
| REQ-COM-009 | DES-TOOL-001（配り方を決めつけない書き方）、DES-TOOL-007（リンクの書き換え）。 |
| REQ-COM-010 | DES-TOOL-008。 |
| NFR-COM-007 | DES-TOOL-007、DES-TOOL-008。 |
