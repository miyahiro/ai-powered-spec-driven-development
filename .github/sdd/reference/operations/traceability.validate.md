# traceability.validate

`tasks.json` と `traceability.json` の参照を検査します。書き込みはしません。意味の正しさはレビューで確かめます。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。この操作の `expectedRevisions` は `{}` でよい。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `specRoots` | 任意 | ID を集める仕様のパスの配列。省略すると `docs/spec/current` |

- 結果: `result.valid`、`result.findings`（`missing-id`、`missing-file`、`unmapped-requirement`、`unmapped-acceptance` と対象）、`result.semanticReviewRequired: true`。
