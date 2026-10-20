# approval.request

工程の成果物一式の版（manifest）を作り、承認待ちにします。人に承認を依頼するための操作で、承認そのものではありません。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 使う場面: 工程の成果物がそろったとき（タスク分解では使わない）。
- 前提: 中断中でない。期限が現在工程までの質問が解決している。前工程の承認が最新。開発工程では全タスクの検証と独立レビューが済んでいる。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `roots` | 必須 | 承認対象のフォルダ・ファイルの配列。`docs/spec/current/` か案件の変更記録の配下（開発工程はコード・テストも可）。要求定義では `docs/spec/current/requirements` を必ず含める |
| `disposition` | 任意 | 変更なし・対象外の工程で使う。`{ "kind": "unchanged" または "not-applicable", "rationale": 理由, "referenceRevision": 参照した版, "human": 人の回答 }` |

- 結果: `result.phase`、`result.manifest`（対象ファイルごとの版と全体の `revision`）、`result.requiredActor`（承認する人）。状態は `awaiting-approval`（承認待ち）。壁打ち・要求定義・外部設計は発注者、内部設計・開発は技術責任者が承認する。
- 手動利用で確認すること: `roots` に承認してほしい文書がすべて入っているか。
