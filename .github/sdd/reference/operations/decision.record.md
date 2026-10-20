# decision.record

質問への回答などから決まった運用上の決定を記録します。内部設計の ADR とは別のものです。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `text` | 必須 | 決定の内容 |
| `rationale` | 必須 | 根拠 |
| `questionIds` | 必須 | 関連する質問 ID の配列（登録済みのものだけ） |
| `references` | 必須 | 関連する文書のパスの配列（実在するものだけ） |

- 結果: `result.decisionId`（`DEC-0001` から連番）。
