# question.open

質問を登録します。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 使う場面: 決められない前提が見つかったとき。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `text` | 必須 | 質問文 |
| `options` | 必須 | 選択肢の配列（空でもよい） |
| `recommendation` | 必須 | 推奨と理由（空文字でもよい） |
| `impact` | 必須 | 未確定のときの影響の配列 |
| `duePhase` | 必須 | いつまでに決めるか（工程） |

```json
{
  "schemaVersion": 1, "operation": "question.open", "operationId": "question-open-CHG-0001-1",
  "role": "orchestrator", "changeId": "CHG-0001", "branch": null,
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": "sha256:<64桁>" },
  "payload": { "text": "問い合わせの保存期間は何年か", "options": ["1年", "3年"], "recommendation": "3年。監査要件に合わせるため", "impact": ["データ保持の要件"], "duePhase": "requirements" }
}
```

- 結果: `result.questionId`（`Q-0001` から連番）。`duePhase` が現在工程以前なら、状態は `blocked`（阻害）になる。
