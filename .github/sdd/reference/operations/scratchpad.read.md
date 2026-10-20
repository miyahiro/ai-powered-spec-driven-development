# scratchpad.read

案件の状態（`state.json`）、または案件の Scratchpad 内のファイルと、その版を読みます。書き込みはしません。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。この操作の `expectedRevisions` は `{}` でよい。

- 使う場面: 次の request の `expectedRevisions` を取るとき。状況を確認するとき。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `path` | 任意 | `docs/scratchpad/<changeId>/` 配下のファイル。省略すると `state.json` |

```json
{ "schemaVersion": 1, "operation": "scratchpad.read", "role": "orchestrator", "changeId": "CHG-0001", "branch": null, "expectedRevisions": {}, "payload": {} }
```

- 結果: `result` に状態（またはファイルの内容）、`revisions` に `{ パス: 現在の版 }`。
- 主なエラー: 未登録の案件、別案件のパス（`OUT_OF_SCOPE`）。
