# approval.record

工程承認（または却下）を記録します。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 使う場面: 承認役割の人が、示された対象に定型の回答をしたとき。
- 前提: 承認待ちであること。`revision` が `approval.request` の manifest の版と同じで、それ以降に対象が変わっていないこと。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `phase` | 必須 | 現在工程 |
| `revision` | 必須 | 承認する manifest の版（`sha256:<64桁>`） |
| `judgment` | 必須 | `approved`（承認）/ `rejected`（却下） |
| `human` | 必須 | 承認役割の人の回答。`approved` のときは定型の承認の回答 |

- 結果: 承認を追記し、状態は `approved`（却下なら `active`）。次工程への移行は [`workflow.transition`](workflow.transition.md) の `advance` で行う。開発工程の承認は Git 操作・マージの許可ではない。
- 主なエラー: 古い版への承認、定型でない回答、承認役割と違う人（すべて `APPROVAL_REQUIRED`）。
- 手動利用で確認すること: `revision` が、示された承認対象の版か。`actor` が承認役割の人か。
