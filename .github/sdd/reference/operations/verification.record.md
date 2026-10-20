# verification.record

人の手動検証、またはレビューの結果を証跡として記録します。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 前提: 窓口だけが使える。`verification.record` の許可があること。`passed` のときは入力の版が現在と一致すること。

| payload.evidence | 必須 | 内容 |
| --- | --- | --- |
| `schemaVersion` | 必須 | `1` |
| `id` | 必須 | 証跡 ID |
| `mode` | 必須 | `manual`（手動検証）/ `review`（レビュー）。`automatic` は不可 |
| `taskIds` | 必須 | 対象タスク ID |
| `inputRevisions` | 必須 | 確認した入力ファイルの版 |
| `environment` | 必須 | 確認した環境 |
| `timestamp` | 必須 | UTC 時刻 |
| `method` | 必須 | 手順 |
| `status` | 必須 | `passed` / `failed` / `not-run` / `unavailable` / `out-of-scope` |
| `result` | 必須 | 観測した結果 |
| `nextAction` | 必須 | 次の作業（なければ空文字） |
| `human` | 必須 | 確認者の回答 |
| `independent`、`reviewer` | `review` で必須 | 独立したレビューか、レビューした者 |
| `tddStage`、`failureKind` | 任意 | TDD の段階、失敗の分類（`behavior` / `environment` / `syntax` / `unknown`） |

`command` と `exitCode` は付けられません（実行していないコマンドを記録しないため）。
