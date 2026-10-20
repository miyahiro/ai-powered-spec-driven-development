# question.record_answer

質問への人の回答を記録します。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 使う場面: 人が質問に答えたとき。回答を正式な文書へ反映したとき。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `questionId` | 必須 | `Q-0001` など |
| `human` | 必須 | 人の回答（[human](../request.md#人の回答human)） |
| `reflectedIn` | 任意 | 回答を反映した文書のパスの配列。実在するファイルだけ |

- 結果: `reflectedIn` があれば質問は `resolved`（解決）、なければ `answered`（回答のみ）。回答の記録だけでは承認・許可にならない。
- 手動利用で確認すること: `answer` の要旨が自分の回答どおりか。`reflectedIn` の文書に実際に反映されているか。
