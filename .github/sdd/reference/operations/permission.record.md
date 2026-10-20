# permission.record

人の操作許可を記録します。工程承認とは別のものです。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 使う場面: 文書の編集、検証の実行、取り込みの記録などを始める前。

| payload.permission | 必須 | 内容 |
| --- | --- | --- |
| `operations` | 必須 | 許可する操作。例: `document.update`、`scratchpad.update`、`verification.run`、`verification.record`、`merge`（取り込みの記録） |
| `editPaths` | 必須 | 編集してよいパス（前方一致）の配列 |
| `readPaths` | 必須 | 検証で読み取ってよいパスの配列 |
| `outputPaths` | 必須 | 検証で生成してよいパスの配列 |
| `profiles` | 必須 | 使ってよい検証プロファイル名の配列 |
| `allowDelete` | 必須 | 削除を許すか |
| `human` | 必須 | 人の許可の回答（定型） |
| `phase` | 任意 | 工程担当に与える場合の工程 |
| `roles` | 任意 | 工程担当に与える場合の役割の配列。`reviewer` は不可。`phase`・`roles` がない許可は窓口だけが使える |

```json
{
  "schemaVersion": 1, "operation": "permission.record", "operationId": "permission-CHG-0001-1",
  "role": "orchestrator", "changeId": "CHG-0001", "branch": null,
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": "sha256:<64桁>" },
  "payload": { "permission": {
    "operations": ["document.update"], "editPaths": ["docs/spec/changes/CHG-0001/idea.md"],
    "readPaths": [], "outputPaths": [], "profiles": [], "allowDelete": false,
    "phase": "ideation", "roles": ["ideation"],
    "human": { "actor": "山田", "answer": "許可します", "source": "Copilot Chat の対話（CHG-0001 アイデア文書の編集許可）", "timestamp": "2026-10-20T01:00:00Z", "recordedBy": "sdd-orchestrator" }
  } }
}
```

- 結果: 許可を追記する（書き換え・削除はしない）。同じ範囲の作業には何度でも使える。
- 手動利用で確認すること: 対象・範囲・削除の可否が、対話で合意したとおりか。広すぎるパスになっていないか。
