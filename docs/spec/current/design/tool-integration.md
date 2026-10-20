# ツール・Git・検査スクリプト設計

入力: [ツール要求](../requirements/tool-integration.md)、[共通要求](../requirements/common.md)。

## DES-TOOL-001 環境と配置

| 項目 | 選択 |
| --- | --- |
| 対象 | VS Code Local の Copilot Chat（custom agents と agent skills が使えること） |
| Node.js | 検査スクリプト用。標準モジュールだけを使い、依存は持たない（20 以上を想定） |
| Git | 状態の確認、ローカルのブランチ・コミット |
| MCP・専用サーバー・Spec Kit | 使わない |

```text
.github/
  copilot-instructions.md           # 共通ルール
  agents/
    sdd-orchestrator.agent.md       # 窓口
    sdd-designer.agent.md           # 設計
    sdd-implementer.agent.md        # 実装
    sdd-reviewer.agent.md           # レビュー
  skills/<name>/SKILL.md            # 12の手順（必要なものは templates/ を持つ）
  sdd/
    README.md                       # 導入・管理ガイド
    user_guide.md                   # 利用者向けガイド
    check.mjs                       # 検査スクリプト
    package.json                    # テストの実行用（依存なし）
    test/                           # 検査スクリプトと配布設定のテスト
```

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

`node .github/sdd/check.mjs [変更ID] [--json]` で実行する。ファイルを書き換えず、Git は読み取りのコマンドだけを使う。

| 検査 | 対象 | 種別 |
| --- | --- | --- |
| ID の重複 | `docs/spec/current/requirements/` の表の先頭列の `REQ`・`NFR`・`AC`・`FUN` の ID、`docs/spec/current/design/` の `DES` の ID（見出しと表の先頭列） | エラー |
| 受入条件のない要件 | 要件の `REQ`・`NFR` のうち、どの受入条件の「対象」にも出てこないもの | エラー |
| リンク切れ | `docs/` と `.github/` の Markdown の相対リンク（ファイルと見出しのアンカー） | エラー |
| 状態ファイルの形式 | `docs/spec/changes/*/status.md` の frontmatter の項目と値、質問・承認の表の値（DES-SPEC-003） | エラー |
| タスク一覧の形式 | `docs/spec/changes/*/tasks.md` の状態の値 | エラー |
| 期限の来た質問 | 現在の工程までが期限の `open` の質問 | 警告 |
| 承認後の変更 | 承認の行ごとに、`approve(<工程>): <変更ID>` のコミットと今の作業ツリーの差分を対象のパスについて取り、変わったファイルがあるか | 警告 |
| 承認のコミットがない | 承認の行に対応するコミットが見つからない | 警告 |

変更 ID を指定すると、その案件の要約（題名・規模・工程・状態・ブランチと今のブランチ・期限の来た質問・承認と再承認が必要な工程・タスクの件数・次の作業）も出す。`--json` で同じ内容を JSON で出す。

- 終了コードは、エラーがあれば 1、なければ 0。警告だけでは 0。
- 出力には、ファイルのパス・行・ID・質問の文と要点だけを含める。文書の本文は出さない。token・鍵などの秘密らしい文字列は伏せて出す。

## DES-TOOL-004 安全

- ターミナルの実行と編集は、Copilot / VS Code の標準の確認に従う。利用者がツールの自動承認を設定するかは利用者が決める。
- 独自の hook・ガード・隔離実行環境は持たない。AI に許す Git 操作は DES-TOOL-002 のとおりで、共通 instructions とエージェントの指示で守る。
- 外部サービスへの書き込み、実際の購入・送信、本番の資格情報を使う操作はしない。テストは開発環境の中で行う。
- 既存の文書・コードの部分的な変更は、エディターの差分の編集で行う。

## DES-TOOL-005 導入

1. 導入先へ `.github/copilot-instructions.md`、`.github/agents/`、`.github/skills/`、`.github/sdd/` をコピーする。同じファイルがあれば差分を確かめ、無条件に上書きしない。
2. `node .github/sdd/check.mjs` で検査スクリプトが動くことを確かめる（依存のインストールは不要）。
3. Copilot Chat で `sdd-orchestrator` を選び、依頼する。

更新も同じ手順で行う。自動の更新機構は作らない。

## 要求との対応

| 要求 | 設計 |
| --- | --- |
| REQ-TOOL-001 | DES-TOOL-001。 |
| REQ-TOOL-002 | DES-TOOL-002。 |
| REQ-TOOL-003 | DES-TOOL-004。 |
| REQ-TOOL-004 | DES-TOOL-004、DES-COM-007。 |
| REQ-TOOL-005 | DES-TOOL-003。 |
| NFR-TOOL-001 | DES-TOOL-003。 |
| NFR-TOOL-002 | DES-SPEC-003、DES-TOOL-003。 |
