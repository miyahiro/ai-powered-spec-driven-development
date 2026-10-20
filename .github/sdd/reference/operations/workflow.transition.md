# workflow.transition

進行状態や工程を変えます。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `action` | 必須 | 下表のどれか |
| `human` | `pause` / `resume` / `return` で必須 | 人の依頼 |
| `nextPhase` | `return` で必須 | 戻す先の工程（現在または前の工程） |

| action | 使う場面 | 前提・結果 |
| --- | --- | --- |
| `activate` | 作業を始める・阻害が解消した | `draft` / `active` / `blocked` から。期限の来た質問が解決し、前工程の承認が最新なら `active` |
| `pause` | 人が「止めて」と依頼した | 直前の状態を保存して `paused` |
| `resume` | 人が「再開して」と依頼した | `paused` から。前提と質問を再照合して直前の状態に戻す |
| `return` | 人が前の工程へ戻すよう依頼した | 指定した工程を `active` にする。以前の承認は履歴として残る |
| `advance` | 工程承認の後 | 現在工程の承認（タスク分解では追跡表の検査）を確認して次の工程を `active` にする。開発以外では Git のブランチと基点の登録が必要。開発工程では完了条件を確かめて `completed` にする。工程は飛ばせない |
