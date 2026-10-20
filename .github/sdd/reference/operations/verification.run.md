# verification.run

隔離環境（bubblewrap）で、人が確認済みの検証プロファイルを実行し、自動の証跡を作ります。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 前提: 開発工程。`verification.run` の許可の `profiles` にプロファイルがあり、プロファイルの読み取り先・生成先が許可の範囲内。`profile.json` のプロファイルが `isolationVerified: true`。
- `expectedRevisions` には `state.json` と、証跡ファイル `docs/spec/changes/<changeId>/verification/<id>.json` の現在版（新規は `null`）を入れる。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `id` | 必須 | 証跡 ID（英数字・`_`・`-`） |
| `profile` | 必須 | 検証プロファイル名 |
| `taskIds` | 必須 | 対象タスク ID の配列 |
| `inputRevisions` | 必須 | 検証する入力ファイルの現在版 `{ パス: 版 }` |
| `method` | 任意 | 検証方法の説明 |
| `tddStage` | 任意 | `red` / `green` / `refactor` / `not-applicable` |

- 結果: 証跡（`mode: automatic`、実際の `command` と `exitCode`）。失敗の分類は `unknown` で、意図した Red かどうかは人が手動の証跡で分類する。隔離できなければ `ENVIRONMENT_UNSUPPORTED` で、隔離なしの再実行はしない。
