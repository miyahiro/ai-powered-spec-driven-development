# ワークフロー・エージェント・スキル設計

入力: [ワークフロー要求](../requirements/workflow-orchestration.md)。共通方針: [README.md](README.md)。

## DES-WF-001 対話と工程

外部インターフェースは Copilot Chat の対話である。以下は入力例で、固定のコマンドではない。

| 利用者の意図 | 窓口の処理 | 応答 |
| --- | --- | --- |
| 新しい仕組みを考えたい／〜を直したい | 受付（DES-WF-003 `change-intake`） | 変更 ID・規模の推奨・承認者・ブランチ名の確認 |
| 状況を教えて | `status.md` と検査スクリプトの要約だけを読む | 工程・状態・期限の来た質問・承認待ち・再承認が必要な工程・タスク・次の作業 |
| 承認します（または確認フォームの「承認する」） | 対象を示した後の回答か、回答者が承認者かを確かめる | 承認のコミットと、次の工程の開始 |
| 止めて／再開して／要件に戻して | 意図を確かめて `status.md` を更新する | 中断・再開・差し戻しの結果と次の作業 |
| この要件を深掘りして（grill-me） | 深掘り（DES-WF-003 `grill-me`） | 1問ずつの質問と推奨、記録した答え |
| この設計書をレビューして | レビュー担当に読み取り専用で依頼する | 指摘と修正案だけ |

工程と承認は規模で決まる。

| 規模 | 工程（`phase` の値） | 承認（ゲート） |
| --- | --- | --- |
| 標準 | `ideation` → `requirements` → `design` → `implementation` → `done` | `requirements`、`design`、`completion` |
| 軽量 | `outline` → `implementation` → `done` | `outline`、`completion` |

- 壁打ち（`ideation`）には承認を置かない。結果は要件の承認でまとめて確かめる。
- 軽量の「要点」（`outline`）では、原本の要件を差分で直接更新し、設計の要点を `docs/spec/changes/<ID>/outline.md` に数行で書く。両方を1回で承認する。
- 外部設計・内部設計は標準の `design` で一緒に承認する。外部設計が不要なら、理由を内部設計の文書か `status.md` に1行残す。
- 規模の変更と前の工程への差し戻しは人の確認を得て `status.md` を更新する。差し戻した工程以降の承認は、再承認が必要として扱う。

進行状態（`state`）は `active`（作業中）、`waiting-approval`（承認待ち）、`blocked`（期限の来た質問などで止まっている）、`paused`（中断）、`done`（完了）とする。

## DES-WF-002 エージェント構成

| 設定 | 責務 | tools | 備考 |
| --- | --- | --- | --- |
| `sdd-orchestrator.agent.md` | 窓口。受付、壁打ち、要件・要点、質問、承認とコミット、`status.md`、状況確認、委任 | `read`、`search`、`edit`、`execute`、`agent`、`vscode_askQuestions` | 利用者が選ぶのはこれだけ（`user-invocable: true`）。呼べる担当は下の3つ |
| `sdd-designer.agent.md` | 外部設計、内部設計、ADR | `read`、`search`、`edit` | `user-invocable: false` |
| `sdd-implementer.agent.md` | タスク分解、テスト先行の実装、確認の記録 | `read`、`search`、`edit`、`execute` | `user-invocable: false` |
| `sdd-reviewer.agent.md` | 仕様と実装の独立レビュー | `read`、`search` | 書き込みもターミナルも使わない |

- hook は付けない。ツールの実行と編集はホストの標準の確認に従う。
- 承認とコミットは窓口だけが行う。担当はコミットしない。
- モデルは固定しない。

## DES-WF-003 スキル構成

スキルは `.github/skills/<name>/SKILL.md` に置き、各スキルは「入力」「手順」「停止」「出力」を持つ。テンプレートは該当スキルの `templates/` に置き、**新しい文書を作るときだけ** 読む。

| スキル | 使う場面 | 主な出力 |
| --- | --- | --- |
| `change-intake` | 新規・改善・修正の受付 | 変更 ID、規模、承認者、`status.md`、確認後のブランチ |
| `workflow-status` | 状況確認、記録の一覧、再開 | 要約による状況、再開の可否 |
| `clarification` | 質問の整理と回答の反映 | `status.md` の質問の表、成果物への反映 |
| `grill-me` | 承認の前の深掘り（任意） | 1問ずつの質問、`clarification` と同じ形の記録と反映 |
| `phase-approval` | 承認の依頼と承認のコミット | 承認の行、承認のコミット、次の工程 |
| `idea-dialogue` | 壁打ち | `idea.md`（必要な場合） |
| `requirements-definition` | 要件、軽量の要点 | 原本の要件、`outline.md` |
| `external-design` | 外部設計 | 原本の外部設計（または省略の理由） |
| `ddd-internal-design` | 内部設計、ADR | 原本の内部設計、ADR 案 |
| `change-impact-analysis` | 追加・修正の影響の調査 | 影響の一覧（応答だけ） |
| `task-planning` | タスク分解 | `tasks.md` |
| `tdd-cycle` | テスト先行の実装 | コード・テスト、`tasks.md` の結果 |
| `review` | 仕様・実装のレビュー | 指摘（応答だけ） |

深掘り（`grill-me`）は窓口が行う（確認フォームと編集が要るため）。判断の分かれ道を前提の順に1問ずつ、推奨付きで聞き、原本やコードで分かることは調べて示す。答えの記録と反映は `clarification` の手順を使う。10問程度ごとに続けるかを聞き、人が止めたら止める。承認の条件にはしない。

## DES-WF-004 承認とコミット

1. 要件・設計・要点の承認を求める前に、その工程でまだ深掘りをしていなければ、一度だけ提案する。断られたら、そのまま承認へ進む。完了の承認では提案しない。
2. 窓口が工程の成果物の一覧（`git status --short` と `git diff --stat` から作る）と変更の要点を示し、確認フォーム（`vscode_askQuestions`）で「承認する／修正する」を聞く。自由入力では「承認します」「この工程を承認します」など明確な肯定だけを承認とする。
3. 回答者が `status.md` の `approvers` にいるかを確かめる。曖昧・条件付きの回答、対象を示す前の回答は聞き直す。
4. `status.md` の承認の表に行を追加する（工程・日時・承認者・対象のパス）。`state` を次の工程の `active` にし、`phase` を進める。
5. 対象のパスと `status.md` だけを `git add -- <パス>` で指定し、次のメッセージでコミットする。

```text
approve(<gate>): <変更ID> <題名>

承認者: <名前>
対象: <パス>, <パス>
```

6. コミットのハッシュを応答で示す。

承認後に対象が変わったかは、検査スクリプトが「その承認のコミット」と「今の作業ツリー」の差分を対象のパスについて取って判定する（DES-TOOL-003）。変わっていれば、その工程は再承認が必要として示す。

工程の承認は、次の工程の範囲（`status.md` の範囲と設計に書いたパス）での編集・ローカルのテスト・作業の区切りのコミット（`chg(<変更ID>): <要点>`）の許可を兼ねる。範囲外の変更・削除・新しい依存の追加は、その都度聞く。push・PR・マージは行わず、手順を案内する。

## DES-WF-005 委任と返却

委任はパスと要点だけで行い、文書の本文・要約・会話全文を渡さない。

```text
変更 ID: CHG-0001 / 工程: design / ブランチ: change/CHG-0001
読むもの: docs/spec/current/requirements/inquiry.md の REQ-INQ-003〜005
編集してよい範囲: docs/spec/current/design/
制約: 承認しない・コミットしない
返却: 変更したファイル、要点（数行）、質問
```

返却を受けた窓口は、文書を読み直さずに `git status --short` と `git diff --stat` で、変更されたファイルが返却と一致し、範囲内にあることを確かめる。食い違えば返却を採用しない。内容の確認はレビュー担当と人の承認で行う。

## DES-WF-006 状況確認・中断・再開

- 状況確認: `node .github/sdd/check.mjs <変更ID>` を実行し、その要約と `status.md` だけで答える。成果物を個別に読まない。
- 中断: `state` を `paused` にし、「次の作業」に再開する地点を書く。作業中のコードがあれば `chg(<変更ID>): 中断時点` としてコミットするかを聞く。
- 再開: 検査スクリプトの要約で、ブランチ、再承認が必要な工程、期限の来た質問を確かめる。不一致がなければ `state` を戻して続ける。

## 要求との対応

| 要求 | 設計 |
| --- | --- |
| REQ-WF-001 | DES-WF-003 `change-intake`、DES-SPEC-003。 |
| REQ-WF-002 | DES-TOOL-002。 |
| REQ-WF-003 | DES-WF-001。 |
| REQ-WF-004 | DES-WF-004 の2・3。 |
| REQ-WF-005 | DES-WF-004 の4〜6、DES-TOOL-003。 |
| REQ-WF-006 | DES-WF-004。 |
| REQ-WF-007 | DES-SPEC-003。 |
| REQ-WF-008 | DES-WF-006、DES-TOOL-003。 |
| REQ-WF-009 | DES-WF-006。 |
| REQ-WF-010 | DES-WF-005。 |
| REQ-WF-011 | DES-WF-002、DES-DEV-003。 |
| REQ-WF-012 | DES-WF-003。 |
| REQ-WF-013 | DES-WF-003（`grill-me`）、DES-WF-004 の1。 |
| NFR-WF-001 | DES-SPEC-003。 |
| NFR-WF-002 | DES-WF-001。 |
